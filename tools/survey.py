"""Measurements straight from the LiDAR mesh, in the room frame.

    python3 -I tools/survey.py scan/Room walls
    python3 -I tools/survey.py scan/Room box NAME x0 x1 z0 z1 y0 y1 [up|side]
    python3 -I tools/survey.py scan/Room map x0 x1 z0 z1 y0 y1 [up|side] [cell]

`walls` fits the four walls and reports how far each is from the frame.
`box` reports the extent of the mesh inside a search volume. `map` prints a
top-down grid of that volume: median height in cm for `up`, hits otherwise.
`yaw NAME x0 x1 z0 z1 y0 y1` reports how far the upright faces inside the
volume are turned from the room axes, between -45 and 45 degrees.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from roomframe import ROOM, to_room_matrix

SAMPLES_PER_FACE = 8


def load(root):
    raw = open(os.path.join(root, "mesh/room-0.ply"), "rb").read()
    start = raw.index(b"end_header\n") + 11
    header = raw[:start]
    count_v = int(header.split(b"element vertex ")[1].split(b"\n")[0])
    count_f = int(header.split(b"element face ")[1].split(b"\n")[0])
    vertex = np.dtype([("p", "<f4", 3), ("n", "<f4", 3), ("cov", "<f4"), ("rgb", "u1", 3), ("inroom", "u1")])
    face = np.dtype([("c", "u1"), ("i", "<u4", 3), ("cls", "u1")])
    vertices = np.frombuffer(raw, vertex, count_v, start)
    faces = np.frombuffer(raw, face, count_f, start + count_v * vertex.itemsize)
    rotation, centre = to_room_matrix()
    triangles = ((vertices["p"] - centre) @ rotation.T)[faces["i"]]
    cross = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    area = np.linalg.norm(cross, axis=1) / 2
    normal = cross / (2 * area[:, None] + 1e-12)
    return dict(triangles=triangles, normal=normal, area=area, wall=faces["cls"] == 1)


def samples(mesh):
    weights = np.random.default_rng(2).dirichlet([1, 1, 1], (len(mesh["triangles"]), SAMPLES_PER_FACE))
    points = np.einsum("fkc,fcd->fkd", weights, mesh["triangles"]).reshape(-1, 3)
    return points, np.repeat(mesh["normal"], SAMPLES_PER_FACE, axis=0)


def facing(normals, kind):
    if kind == "up":
        return abs(normals[:, 1]) > 0.85
    if kind == "side":
        return abs(normals[:, 1]) < 0.35
    return np.ones(len(normals), bool)


def within(points, bounds):
    x0, x1, z0, z1, y0, y1 = bounds
    return (points[:, 0] > x0) & (points[:, 0] < x1) & (points[:, 2] > z0) & (points[:, 2] < z1) & (points[:, 1] > y0) & (points[:, 1] < y1)


def report_walls(mesh):
    centre = mesh["triangles"].mean(axis=1)
    normal, area = mesh["normal"], mesh["area"]
    upright = mesh["wall"] & (abs(normal[:, 1]) < 0.15) & (centre[:, 1] > 1.6)
    half_w, half_d = ROOM["width"] / 2, ROOM["depth"] / 2
    cases = [
        ("door wall", 0, 2, (normal[:, 0] > 0.9) & (centre[:, 0] < -1.1), -half_w),
        ("right wall", 0, 2, (normal[:, 0] < -0.9) & (centre[:, 0] > 1.1), half_w),
        ("window wall", 2, 0, (normal[:, 2] > 0.9) & (centre[:, 2] < -1.8), -half_d),
        ("back wall", 2, 0, (normal[:, 2] < -0.9) & (centre[:, 2] > 1.8), half_d),
    ]
    for name, axis, along, chosen, expected in cases:
        picked = upright & chosen
        slope, offset = np.polyfit(centre[picked, along], centre[picked, axis], 1, w=area[picked])
        print(f"{name:12s} at {offset:6.3f} (frame says {expected:6.3f}), turned {np.degrees(np.arctan(slope)):+.2f} deg, {int(picked.sum())} faces")
    points, _ = samples(mesh)
    middle = (abs(points[:, 0]) < 0.6) & (abs(points[:, 2]) < 1.0)
    print(f"floor {np.percentile(points[middle & (points[:, 1] < 0.3), 1], 50):.3f}, ceiling {np.percentile(points[middle & (points[:, 1] > 2.0), 1], 50):.3f}")


def report_box(mesh, name, bounds, kind):
    points, normals = samples(mesh)
    found = points[within(points, bounds) & facing(normals, kind)]
    if len(found) < 30:
        print(f"{name:26s} too few points ({len(found)})")
        return
    x = np.percentile(found[:, 0], [2, 98])
    z = np.percentile(found[:, 2], [2, 98])
    y = np.percentile(found[:, 1], [2, 50, 98])
    print(f"{name:26s} x {x[0]:5.2f}..{x[1]:5.2f} ({x[1] - x[0]:.2f})  z {z[0]:5.2f}..{z[1]:5.2f} ({z[1] - z[0]:.2f})  y {y[0]:.2f}/{y[1]:.2f}/{y[2]:.2f}  n={len(found)}")


def report_yaw(mesh, name, bounds):
    centre = mesh["triangles"].mean(axis=1)
    normal, area = mesh["normal"], mesh["area"]
    chosen = within(centre, bounds) & (abs(normal[:, 1]) < 0.2)
    if chosen.sum() < 40:
        print(f"{name:20s} too few upright faces ({int(chosen.sum())})")
        return
    turn = np.degrees(np.arctan2(normal[chosen, 2], normal[chosen, 0])) % 90
    turn = np.where(turn > 45, turn - 90, turn)
    histogram, edges = np.histogram(turn, bins=45, range=(-45, 45), weights=area[chosen])
    peak = int(np.argmax(histogram))
    near = abs(turn - (edges[peak] + 1)) < 4
    best = np.average(turn[near], weights=area[chosen][near])
    share = histogram[max(0, peak - 2):peak + 3].sum() / histogram.sum()
    print(f"{name:20s} turned {best:+5.1f} deg from the room axes, {share:4.0%} of {area[chosen].sum():.2f} m2 upright surface agrees")


def report_map(mesh, bounds, kind, cell):
    points, normals = samples(mesh)
    found = points[within(points, bounds) & facing(normals, kind)]
    x0, x1, z0, z1 = bounds[:4]
    columns, rows = int(round((x1 - x0) / cell)), int(round((z1 - z0) / cell))
    column = np.clip(((found[:, 0] - x0) / cell).astype(int), 0, columns - 1)
    row = np.clip(((found[:, 2] - z0) / cell).astype(int), 0, rows - 1)
    print("      " + "".join(f"{x0 + c * cell:6.2f}"[-3:] if c % 2 == 0 else "   " for c in range(columns)))
    for r in range(rows):
        line = ""
        for c in range(columns):
            chosen = (column == c) & (row == r)
            if chosen.sum() < 4:
                line += "  ."
            elif kind == "up":
                line += f"{int(round(np.median(found[chosen, 1]) * 100)):3d}"
            else:
                line += " ##"
        print(f"{z0 + r * cell:5.2f} {line}")


if __name__ == "__main__":
    root, command = sys.argv[1], sys.argv[2]
    mesh = load(root)
    if command == "walls":
        report_walls(mesh)
    elif command == "box":
        name = sys.argv[3]
        bounds = [float(value) for value in sys.argv[4:10]]
        report_box(mesh, name, bounds, sys.argv[10] if len(sys.argv) > 10 else "all")
    elif command == "yaw":
        report_yaw(mesh, sys.argv[3], [float(value) for value in sys.argv[4:10]])
    elif command == "map":
        bounds = [float(value) for value in sys.argv[3:9]]
        kind = sys.argv[9] if len(sys.argv) > 9 else "all"
        report_map(mesh, bounds, kind, float(sys.argv[10]) if len(sys.argv) > 10 else 0.05)
