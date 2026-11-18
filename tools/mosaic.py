"""Rectified photo mosaics of the walls and the floor, built from the scan photos.

Every scan photo carries its camera pose and intrinsics, so a flat surface in the
room can be reprojected into a straight-on image. Per output pixel the photo
that sees it most frontally and most centrally wins. ARKit cameras look along
their local -Z axis.

    python3 -I tools/mosaic.py scan/Room out_dir [surface ...] [--offset=0.4]

The offset moves the sampled plane into the room, which brings furniture that
stands in front of a wall into register.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from roomframe import ROOM, to_room_matrix

PX_PER_M = 240


def cameras(root):
    rotation, center = to_room_matrix()
    cams = []
    for photo in json.load(open(os.path.join(root, "photos/photos.json"))):
        pose = np.array(photo["transform"]).reshape(4, 4).T
        k = np.array(photo["intrinsics"]).reshape(3, 3).T
        cams.append(
            dict(
                file=os.path.join(root, photo["file"]),
                rot=rotation @ pose[:3, :3],
                pos=rotation @ (pose[:3, 3] - center),
                fx=k[0, 0], fy=k[1, 1], cx=k[0, 2], cy=k[1, 2],
                w=photo["width"], h=photo["height"], blur=photo.get("blurPixels", 2.0),
            )
        )
    return cams


def surfaces():
    hx, hz, h = ROOM["width"] / 2, ROOM["depth"] / 2, ROOM["height"]
    return {
        "door": dict(origin=[-hx, 0, hz], u=[0, 0, -1], v=[0, 1, 0], normal=[1, 0, 0], size=(2 * hz, h)),
        "right": dict(origin=[hx, 0, -hz], u=[0, 0, 1], v=[0, 1, 0], normal=[-1, 0, 0], size=(2 * hz, h)),
        "window": dict(origin=[-hx, 0, -hz], u=[1, 0, 0], v=[0, 1, 0], normal=[0, 0, 1], size=(2 * hx, h)),
        "back": dict(origin=[hx, 0, hz], u=[-1, 0, 0], v=[0, 1, 0], normal=[0, 0, -1], size=(2 * hx, h)),
        "floor": dict(origin=[-hx, 0, hz], u=[1, 0, 0], v=[0, 0, -1], normal=[0, 1, 0], size=(2 * hx, 2 * hz)),
    }


def region_of(surface, u_range, v_range):
    origin, u, v = (np.array(surface[k], float) for k in ("origin", "u", "v"))
    return dict(surface, origin=origin + u_range[0] * u + v_range[0] * v, size=(u_range[1] - u_range[0], v_range[1] - v_range[0]))


def bake(surface, cams, offset=0.0, density=PX_PER_M):
    origin, u, v, normal = (np.array(surface[k], float) for k in ("origin", "u", "v", "normal"))
    width, height = (int(round(s * density)) for s in surface["size"])
    us = (np.arange(width) + 0.5) / density
    vs = surface["size"][1] - (np.arange(height) + 0.5) / density
    points = origin + us[None, :, None] * u + vs[:, None, None] * v + offset * normal
    best = np.full((height, width), -1.0)
    out = np.zeros((height, width, 3), np.uint8)
    for cam in cams:
        ray = points - cam["pos"]
        local = ray @ cam["rot"]
        depth = -local[..., 2]
        with np.errstate(divide="ignore", invalid="ignore"):
            px = cam["fx"] * local[..., 0] / depth + cam["cx"]
            py = cam["cy"] - cam["fy"] * local[..., 1] / depth
        distance = np.linalg.norm(ray, axis=-1)
        facing = -(ray @ normal) / distance
        rx = (px - cam["w"] / 2) / (cam["w"] / 2)
        ry = (py - cam["h"] / 2) / (cam["h"] / 2)
        visible = (depth > 0.15) & (abs(rx) < 0.94) & (abs(ry) < 0.94) & (facing > 0.25)
        score = facing * (1 - 0.6 * np.maximum(abs(rx), abs(ry)) ** 2) / (1 + 0.15 * cam["blur"])
        score = np.where(visible, score, -1)
        wins = score > best
        if not wins.any():
            continue
        image = np.asarray(Image.open(cam["file"]).convert("RGB"))
        ix = np.clip(px[wins].astype(int), 0, cam["w"] - 1)
        iy = np.clip(py[wins].astype(int), 0, cam["h"] - 1)
        out[wins] = image[iy, ix]
        best[wins] = score[wins]
    return Image.fromarray(out)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    offset = next((float(a.split("=")[1]) for a in sys.argv if a.startswith("--offset=")), 0.0)
    root, out_dir = args[0], args[1]
    os.makedirs(out_dir, exist_ok=True)
    cams = cameras(root)
    all_surfaces = surfaces()
    suffix = f"-{offset:g}" if offset else ""
    for name in args[2:] or all_surfaces:
        image = bake(all_surfaces[name], cams, offset)
        image.save(os.path.join(out_dir, f"{name}{suffix}.jpg"), quality=88)
        print(name, image.size)
