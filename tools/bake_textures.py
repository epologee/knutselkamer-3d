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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mosaic import cameras, surfaces
from roomframe import ROOM

PX_PER_M = 900

PICTURES = [
    dict(name="pansies", wall="right", u=(0.2, 0.9), v=(1.89, 2.39)),
    dict(name="harbour", wall="right", u=(0.93, 1.47), v=(1.9, 2.33)),
    dict(name="bridge", wall="right", u=(0.245, 0.895), v=(1.115, 1.8)),
    dict(name="mirror", wall="right", u=(1.035, 1.55), v=(1.2, 1.81)),
    dict(name="print", wall="right", u=(1.59, 2.025), v=(1.675, 2.02)),
    dict(name="family", wall="right", u=(1.61, 2.08), v=(1.26, 1.57)),
    dict(name="apples", wall="right", u=(2.195, 3.035), v=(1.62, 2.175)),
    dict(name="poppy", wall="right", u=(2.48, 2.84), v=(1.265, 1.535)),
    dict(name="drawing", wall="window", u=(0.835, 1.33), v=(2.1, 2.43)),
    dict(name="fields", wall="window", u=(1.65, 2.37), v=(2.11, 2.445)),
    dict(name="class-photo", wall="back", u=(1.42, 2.045), v=(1.64, 2.19)),
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
        points, normal = region_points(walls[picture["wall"]], picture["u"], picture["v"])
        cam = best_single_photo(points, normal, cams)
        if cam is None:
            print("no single photo covers", picture["name"])
            continue
        publishable(sample(points, cam), picture["name"]).save(os.path.join(out_dir, picture["name"] + ".jpg"), quality=90)
        manifest.append(picture)
        print(picture["name"], os.path.basename(cam["file"]))
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
