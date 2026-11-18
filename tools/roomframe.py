"""The room frame shared by every tool and by the web scene.

Meters, +Y up, origin on the floor in the middle of the room. The window wall
is at -Z, the door wall at -X.

The scan is in ARKit world space. RoomPlan reports four walls as a clean
rectangle, but the LiDAR mesh and the photo poses sit about five degrees
rotated and a hand's width shifted from that rectangle. Furniture is measured
in the mesh, so the frame follows the walls as the mesh has them: the RoomPlan
rectangle first, then the correction found by fitting the mesh wall faces.
"""
import math

import numpy as np

ROOM = dict(width=2.784, depth=4.27, height=2.49)

_ROOMPLAN_CENTER = np.array([0.20, -1.31, -0.62])
_ROOMPLAN_X_AXIS = np.array([0.82, 0.0, 0.575])

MESH_YAW_DEGREES = 4.7
MESH_SHIFT = np.array([-0.095, 0.047, 0.0425])


def _roomplan_matrix():
    x = _ROOMPLAN_X_AXIS / np.linalg.norm(_ROOMPLAN_X_AXIS)
    z = np.array([-x[2], 0.0, x[0]])
    return np.stack([x, [0.0, 1.0, 0.0], z])


def to_room_matrix():
    """Rotation and centre such that room = rotation @ (world - centre)."""
    roomplan = _roomplan_matrix()
    yaw = math.radians(MESH_YAW_DEGREES)
    correction = np.array([
        [math.cos(yaw), 0.0, math.sin(yaw)],
        [0.0, 1.0, 0.0],
        [-math.sin(yaw), 0.0, math.cos(yaw)],
    ])
    centre = _ROOMPLAN_CENTER + roomplan.T @ MESH_SHIFT
    return correction @ roomplan, centre
