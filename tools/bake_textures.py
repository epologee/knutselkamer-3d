"""Crops for the web scene: one rectified image per framed picture, plus the garden view.

Each crop comes from the single scan photo that sees the whole region best, so
a picture never shows a seam. Regions are in wall coordinates: u in meters
along the wall from its left corner as seen from inside the room, v in meters
above the floor.

    python3 -I tools/bake_textures.py scan/Room public/baked
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from skimage import transform

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mosaic import cameras, surfaces
from roomframe import ROOM

PX_PER_M = 900

PICTURES = [
    dict(name="pansies", wall="right", photo="0155", corners=[(0.273, 2.394), (0.903, 2.391), (0.903, 1.911), (0.303, 1.911)]),
    dict(name="harbour", wall="right", photo="0156", corners=[(0.944, 2.314), (1.472, 2.331), (1.461, 1.914), (0.963, 1.934)]),
    dict(name="bridge", wall="right", photo="0153", corners=[(0.254, 1.797), (0.857, 1.793), (0.868, 1.131), (0.291, 1.127)]),
    dict(
        name="mirror", wall="right", photo="0156", corners=[(1.043, 1.804), (1.536, 1.804), (1.538, 1.233), (1.054, 1.213)],
        glass=[(1.141, 1.724), (1.454, 1.727), (1.471, 1.311), (1.15, 1.304)],
    ),
    dict(name="print", wall="right", photo="0157", corners=[(1.583, 2.013), (2.010, 2.006), (2.016, 1.693), (1.586, 1.688)]),
    dict(name="family", wall="right", photo="0152", corners=[(1.679, 1.559), (2.068, 1.574), (2.072, 1.306), (1.698, 1.281)]),
    dict(name="apples", wall="right", photo="0151", corners=[(2.282, 2.172), (3.033, 2.191), (3.033, 1.650), (2.289, 1.639)]),
    dict(name="poppy", wall="right", photo="0150", corners=[(2.488, 1.519), (2.832, 1.526), (2.830, 1.286), (2.499, 1.272)]),
    dict(name="drawing", wall="window", photo="0002", corners=[(0.843, 2.427), (1.317, 2.416), (1.321, 2.102), (0.847, 2.111)]),
    dict(name="fields", wall="window", photo="0153", corners=[(1.661, 2.441), (2.353, 2.426), (2.353, 2.117), (1.653, 2.122)]),
    dict(name="class-photo", wall="back", photo="0197", corners=[(1.442, 2.150), (2.034, 2.148), (2.014, 1.663), (1.434, 1.652)]),
]

BLUR_BEFORE_PUBLISHING = {"family": 9, "class-photo": 9, "cabinet-door-plus-x": 9, "cabinet-binders": 5}


def publishable(image, name):
    """People, notes and labels stay recognisable only inside the scan, never in a baked texture."""
    radius = BLUR_BEFORE_PUBLISHING.get(name)
    return image.filter(ImageFilter.GaussianBlur(radius)) if radius else image


GARDEN = dict(wall="window", u=(1.67, 2.26), v=(1.2, 1.9), depth_behind_wall=3.0)


CABINET_CENTRE_X = 0.84
CABINET_FRONT_Z = ROOM["depth"] / 2 - 0.565
DOOR_WIDTH = 0.486
DOOR_HEIGHT = 1.98
DOOR_SPLAY_DEGREES = {1: 5, -1: 48}
DOOR_PHOTO_FROM = 0.95
DOOR_PHOTO_TO = 1.85
BINDER_ROW = dict(u=(0.07, 0.93), v=(1.37, 1.69), depth_from_wall=0.44)


def open_door(side):
    """Inner face of a cabinet door that stands open, as a bakeable surface.

    side is +1 for the door at the +X end of the cabinet, -1 for the other.
    """
    splay = math.radians(DOOR_SPLAY_DEGREES[side])
    hinge = np.array([CABINET_CENTRE_X + side * 0.48, 0.0, CABINET_FRONT_Z])
    outward = np.array([side * math.sin(splay), 0.0, -math.cos(splay)])
    inward_normal = np.array([-side * math.cos(splay), 0.0, -math.sin(splay)])
    if side > 0:
        origin, along = hinge + outward * DOOR_WIDTH, -outward
    else:
        origin, along = hinge, outward
    return dict(origin=origin, u=along, v=[0, 1, 0], normal=inward_normal, size=(DOOR_WIDTH, DOOR_HEIGHT))


def region_points(surface, u_range, v_range, offset=0.0):
    origin, u, v, normal = (np.array(surface[k], float) for k in ("origin", "u", "v", "normal"))
    width = int(round((u_range[1] - u_range[0]) * PX_PER_M))
    height = int(round((v_range[1] - v_range[0]) * PX_PER_M))
    us = u_range[0] + (np.arange(width) + 0.5) / PX_PER_M
    vs = v_range[1] - (np.arange(height) + 0.5) / PX_PER_M
    return origin + us[None, :, None] * u + vs[:, None, None] * v + offset * normal, normal


def project(points, cam):
    local = (points - cam["pos"]) @ cam["rot"]
    depth = -local[..., 2]
    with np.errstate(divide="ignore", invalid="ignore"):
        px = cam["fx"] * local[..., 0] / depth + cam["cx"]
        py = cam["cy"] - cam["fy"] * local[..., 1] / depth
    return px, py, depth


def straightened_picture(surface, picture, cam):
    """The picture pulled straight onto its own four corners, plus where it hangs.

    The corners are in wall coordinates, read off the scan photo in the order
    top left, top right, bottom right, bottom left. The texture covers exactly
    that quadrilateral, so its corners land on the corners of the geometry.
    """
    corners = np.array(picture["corners"], float)
    width = (np.linalg.norm(corners[1] - corners[0]) + np.linalg.norm(corners[2] - corners[3])) / 2
    height = (np.linalg.norm(corners[3] - corners[0]) + np.linalg.norm(corners[2] - corners[1])) / 2
    unit_square = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], float)
    onto_wall = transform.ProjectiveTransform.from_estimate(unit_square, corners)
    columns, rows = int(round(width * PX_PER_M)), int(round(height * PX_PER_M))
    s, t = np.meshgrid((np.arange(columns) + 0.5) / columns, (np.arange(rows) + 0.5) / rows)
    on_wall = onto_wall(np.stack([s.ravel(), t.ravel()], axis=1)).reshape(rows, columns, 2)
    origin, u_axis, v_axis = (np.array(surface[k], float) for k in ("origin", "u", "v"))
    points = origin + on_wall[..., :1] * u_axis + on_wall[..., 1:] * v_axis
    centre = corners.mean(axis=0)
    placement = dict(
        u=[round(float(centre[0] - width / 2), 4), round(float(centre[0] + width / 2), 4)],
        v=[round(float(centre[1] - height / 2), 4), round(float(centre[1] + height / 2), 4)],
    )
    if "glass" in picture:
        inside = onto_wall.inverse(np.array(picture["glass"], float))
        placement["glass"] = dict(
            u=[round(float(inside[:, 0].min()), 4), round(float(inside[:, 0].max()), 4)],
            v=[round(float(1 - inside[:, 1].max()), 4), round(float(1 - inside[:, 1].min()), 4)],
        )
    return sample(points, cam), placement


def best_single_photo(points, normal, cams):
    centre = points.reshape(-1, 3).mean(axis=0)
    best, best_score = None, 0.0
    for cam in cams:
        px, py, depth = project(points, cam)
        margin = 12
        inside = (depth > 0.15) & (px > margin) & (px < cam["w"] - margin) & (py > margin) & (py < cam["h"] - margin)
        if not inside.all():
            continue
        ray = centre - cam["pos"]
        distance = np.linalg.norm(ray)
        facing = -(ray @ normal) / distance
        pixels_per_meter = cam["fx"] / distance
        score = facing ** 2 * min(pixels_per_meter, PX_PER_M) / (1 + 0.3 * cam.get("blur", 2.0))
        if score > best_score:
            best, best_score = cam, score
    return best


def sample(points, cam):
    px, py, _ = project(points, cam)
    image = np.asarray(Image.open(cam["file"]).convert("RGB")).astype(np.float32)
    x0 = np.clip(np.floor(px).astype(int), 0, cam["w"] - 2)
    y0 = np.clip(np.floor(py).astype(int), 0, cam["h"] - 2)
    fx = np.clip(px - x0, 0, 1)[..., None]
    fy = np.clip(py - y0, 0, 1)[..., None]
    top = image[y0, x0] * (1 - fx) + image[y0, x0 + 1] * fx
    bottom = image[y0 + 1, x0] * (1 - fx) + image[y0 + 1, x0 + 1] * fx
    return Image.fromarray((top * (1 - fy) + bottom * fy).astype(np.uint8))


if __name__ == "__main__":
    root, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    cams = cameras(root)
    walls = surfaces()
    manifest = []
    for picture in PICTURES:
        cam = next(c for c in cams if os.path.basename(c["file"]) == picture["photo"] + ".jpg")
        image, placement = straightened_picture(walls[picture["wall"]], picture, cam)
        publishable(image, picture["name"]).save(os.path.join(out_dir, picture["name"] + ".jpg"), quality=90)
        manifest.append(dict(name=picture["name"], wall=picture["wall"], **placement))
        print(picture["name"], f"{(placement['u'][1] - placement['u'][0]) * 100:.1f} x {(placement['v'][1] - placement['v'][0]) * 100:.1f} cm")
    json.dump(manifest, open(os.path.join(out_dir, "pictures.json"), "w"), indent=1)

    for name, side in (("cabinet-door-plus-x", 1),):
        door = open_door(side)
        points, normal = region_points(door, (0, DOOR_WIDTH), (DOOR_PHOTO_FROM, DOOR_PHOTO_TO))
        cam = best_single_photo(points, normal, cams)
        if cam is None:
            print("no single photo covers", name)
            continue
        publishable(sample(points, cam), name).save(os.path.join(out_dir, name + ".jpg"), quality=88)
        print(name, os.path.basename(cam["file"]))

    points, normal = region_points(walls["back"], BINDER_ROW["u"], BINDER_ROW["v"], BINDER_ROW["depth_from_wall"])
    cam = best_single_photo(points, normal, cams)
    publishable(sample(points, cam), "cabinet-binders").save(os.path.join(out_dir, "cabinet-binders.jpg"), quality=90)
    print("cabinet-binders", os.path.basename(cam["file"]))


    points, normal = region_points(walls[GARDEN["wall"]], GARDEN["u"], GARDEN["v"])
    cam = best_single_photo(points, normal, cams)
    pane = sample(points, cam).filter(ImageFilter.GaussianBlur(3))
    garden = Image.new("RGB", (pane.width * 2, pane.height))
    garden.paste(pane.transpose(Image.FLIP_LEFT_RIGHT), (0, 0))
    garden.paste(pane, (pane.width, 0))
    garden.save(os.path.join(out_dir, "garden.jpg"), quality=88)
    print("garden", os.path.basename(cam["file"]))
