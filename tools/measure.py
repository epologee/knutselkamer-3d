"""Compare the modelled furniture with what the LiDAR mesh measured.

Draws the mesh as top-down slices per height band with every modelled
footprint on top, and prints per piece how the mesh inside and around its
footprint compares with the modelled size.

    node tools/export-layout.js > reference/layout.json
    python3 -I tools/measure.py scan/Room reference/layout.json reference/measure
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from roomframe import ROOM, to_room_matrix

PX_PER_M = 300
MARGIN = 0.25
BANDS = [("low", 0.06, 0.45), ("middle", 0.45, 1.0), ("high", 1.0, 2.3)]


def mesh_samples(root, per_face=10):
    raw = open(os.path.join(root, "mesh/room-0.ply"), "rb").read()
    start = raw.index(b"end_header\n") + 11
    vertex = np.dtype([("p", "<f4", 3), ("n", "<f4", 3), ("cov", "<f4"), ("rgb", "u1", 3), ("inroom", "u1")])
    face = np.dtype([("c", "u1"), ("i", "<u4", 3), ("cls", "u1")])
    count_v = int(raw[:start].split(b"element vertex ")[1].split(b"\n")[0])
    count_f = int(raw[:start].split(b"element face ")[1].split(b"\n")[0])
    vertices = np.frombuffer(raw, vertex, count_v, start)
    faces = np.frombuffer(raw, face, count_f, start + count_v * vertex.itemsize)
    rotation, centre = to_room_matrix()
    positions = (vertices["p"] - centre) @ rotation.T
    triangles = positions[faces["i"]]
    weights = np.random.default_rng(0).dirichlet([1, 1, 1], (len(triangles), per_face))
    return np.einsum("fkc,fcd->fkd", weights, triangles).reshape(-1, 3)


def to_pixel(x, z):
    return ((x + ROOM["width"] / 2 + MARGIN) * PX_PER_M, (z + ROOM["depth"] / 2 + MARGIN) * PX_PER_M)


def corners(piece, grow=0.0):
    width, _, depth = piece["size"]
    angle = math.radians(piece["rotation"])
    result = []
    for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        lx, lz = sx * (width / 2 + grow), sz * (depth / 2 + grow)
        result.append((piece["x"] + lx * math.cos(angle) + lz * math.sin(angle), piece["z"] - lx * math.sin(angle) + lz * math.cos(angle)))
    return result


def local_coordinates(points, piece):
    angle = math.radians(piece["rotation"])
    dx, dz = points[:, 0] - piece["x"], points[:, 2] - piece["z"]
    return dx * math.cos(angle) - dz * math.sin(angle), dx * math.sin(angle) + dz * math.cos(angle)


def draw_band(points, pieces, low, high, path):
    size = (int((ROOM["width"] + 2 * MARGIN) * PX_PER_M), int((ROOM["depth"] + 2 * MARGIN) * PX_PER_M))
    density = np.zeros((size[1], size[0]), np.float32)
    band = points[(points[:, 1] > low) & (points[:, 1] < high)]
    px, py = to_pixel(band[:, 0], band[:, 2])
    inside = (px >= 0) & (px < size[0]) & (py >= 0) & (py < size[1])
    np.add.at(density, (py[inside].astype(int), px[inside].astype(int)), 1)
    shade = (255 - np.clip(density * 40, 0, 235)).astype(np.uint8)
    image = Image.fromarray(shade).convert("RGB")
    draw = ImageDraw.Draw(image)
    room = [to_pixel(sx * ROOM["width"] / 2, sz * ROOM["depth"] / 2) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    draw.polygon(room, outline=(0, 120, 255))
    for piece in pieces:
        if piece["size"][1] < low:
            continue
        outline = [to_pixel(x, z) for x, z in corners(piece)]
        draw.polygon(outline, outline=(230, 30, 30))
        draw.text(to_pixel(piece["x"] - 0.12, piece["z"] - 0.03), piece["id"], fill=(200, 0, 0))
    image.save(path)


def report(points, pieces):
    print(f"{'piece':16s} {'model w x d x h':>20s}   {'mesh inside: w x d, top':>26s}   spill outside footprint")
    for piece in pieces:
        width, height, depth = piece["size"]
        if height < 0.05:
            continue
        lx, lz = local_coordinates(points, piece)
        above_floor = (points[:, 1] > 0.08) & (points[:, 1] < height + 0.15)
        inside = above_floor & (abs(lx) < width / 2 + 0.02) & (abs(lz) < depth / 2 + 0.02)
        near = above_floor & (abs(lx) < width / 2 + 0.2) & (abs(lz) < depth / 2 + 0.2) & ~inside
        if inside.sum() < 50:
            print(f"{piece['id']:16s} {width:5.2f} x {depth:4.2f} x {height:4.2f}   too few mesh points")
            continue
        span_x = np.percentile(lx[inside], [1, 99])
        span_z = np.percentile(lz[inside], [1, 99])
        top = np.percentile(points[inside, 1], 99)
        spill = near.sum() / max(1, inside.sum())
        print(
            f"{piece['id']:16s} {width:5.2f} x {depth:4.2f} x {height:4.2f}   "
            f"{span_x[1] - span_x[0]:5.2f} x {span_z[1] - span_z[0]:4.2f}, top {top:4.2f}   {spill:4.0%}"
        )


if __name__ == "__main__":
    root, layout_path, out_prefix = sys.argv[1:4]
    pieces = json.load(open(layout_path))
    points = mesh_samples(root)
    os.makedirs(os.path.dirname(out_prefix) or ".", exist_ok=True)
    for name, low, high in BANDS:
        draw_band(points, pieces, low, high, f"{out_prefix}-{name}.png")
    report(points, pieces)
