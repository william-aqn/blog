#!/usr/bin/env python3
"""
Ventilation grille with wide duct collar, internal funnel, Glider+DCRM emblem
All dimensions in mm

ORIENTATION (print-ready):
  - Plate at bottom (room-facing side = z=0 after final shift)
  - Collar goes UP into the shaft
  - Decorations protrude from room-facing surface

LAYOUT (XY, looking from room):
  y=180..210  top margin (plate only)
  y=90..180   grille zone (slats)
  y=30..90    collar/duct zone
  y=0..30     bottom margin — Glider + DCRM
"""

import trimesh
import numpy as np
import os
from scipy.spatial import ConvexHull

# === Parameters ===
SHAFT = 150.0
PLATE = 210.0
WALL = 3.0
DUCT_W = 204.0          # collar width (plate - 6mm)
DUCT_H = 60.0           # collar height (Y)
COLLAR_DEPTH = 30.0
HOLE_DIA = 4.0
HOLE_OFFSET = 15.0
GRILLE_SLAT = 3.0
GRILLE_GAP = 12.0
COLLAR_RADIUS = 5.0

MARGIN = (PLATE - SHAFT) / 2.0  # 30mm

FUNNEL_TOP_W = SHAFT                  # 150 at plate level
FUNNEL_BOT_W = DUCT_W - 2 * WALL     # 204 (wide, at collar exit)
FUNNEL_H = DUCT_H - 2 * WALL         # 54

# Glider/text decoration
GLIDER_SPACING = 10.0
GLIDER_SQ = 7.0         # matches ~text height (5×0.95 ≈ 4.75, with margin)
GLIDER_H = 1.2          # bump height
TEXT_PIXEL = 0.95
TEXT_SPACING = 0.95      # same as pixel = seamless solid letters
TEXT_H = GLIDER_H
TEXT_LETTER_GAP = 1.0    # tighter spacing between letters

center_x = PLATE / 2.0        # 105
center_y = MARGIN + DUCT_H / 2  # 60


# === Helpers ===
def box(sx, sy, sz, tx=0, ty=0, tz=0):
    b = trimesh.creation.box(extents=[sx, sy, sz])
    b.apply_translation([tx + sx/2, ty + sy/2, tz + sz/2])
    return b

def cylinder_z(diameter, height, tx=0, ty=0, tz=0, segments=32):
    c = trimesh.creation.cylinder(radius=diameter/2, height=height, sections=segments)
    c.apply_translation([tx, ty, tz + height/2])
    return c

def rounded_box(sx, sy, sz, radius, tx=0, ty=0, tz=0, segments=32):
    r = min(radius, sx/2, sy/2)
    box_h = box(sx, sy - 2*r, sz, tx=tx, ty=ty + r, tz=tz)
    box_v = box(sx - 2*r, sy, sz, tx=tx + r, ty=ty, tz=tz)
    corners = []
    for cx_, cy_ in [(tx + r, ty + r), (tx + sx - r, ty + r),
                     (tx + r, ty + sy - r), (tx + sx - r, ty + sy - r)]:
        c = trimesh.creation.cylinder(radius=r, height=sz, sections=segments)
        c.apply_translation([cx_, cy_, tz + sz/2])
        corners.append(c)
    result = box_h
    for part in [box_v] + corners:
        result = trimesh.boolean.union([result, part], engine='manifold')
    return result

def frustum(top_w, top_h, bot_w, bot_h, height, cx_, cy_, tz):
    hw_t, hh_t = top_w / 2, top_h / 2
    hw_b, hh_b = bot_w / 2, bot_h / 2
    z_top = tz + height
    z_bot = tz
    points = np.array([
        [cx_ - hw_t, cy_ - hh_t, z_top],
        [cx_ + hw_t, cy_ - hh_t, z_top],
        [cx_ + hw_t, cy_ + hh_t, z_top],
        [cx_ - hw_t, cy_ + hh_t, z_top],
        [cx_ - hw_b, cy_ - hh_b, z_bot],
        [cx_ + hw_b, cy_ - hh_b, z_bot],
        [cx_ + hw_b, cy_ + hh_b, z_bot],
        [cx_ - hw_b, cy_ + hh_b, z_bot],
    ], dtype=float)
    hull = ConvexHull(points)
    m = trimesh.Trimesh(vertices=points, faces=hull.simplices, process=True)
    trimesh.repair.fix_normals(m)
    return m


# ==============================================================
# BUILD — plate at z=0..WALL, collar at z=WALL..WALL+COLLAR_DEPTH
#          decorations at z=-GLIDER_H..0 (below plate, room side)
# ==============================================================

# === 1. Plate ===
print("Creating base plate...")
plate = box(PLATE, PLATE, WALL)

# Cut 1: funnel opening through plate (170 x 54 — matches funnel narrow end)
funnel_top_cut = box(FUNNEL_TOP_W, FUNNEL_H, WALL + 2,
                     tx=center_x - FUNNEL_TOP_W/2,
                     ty=center_y - FUNNEL_H/2, tz=-1)
plate = trimesh.boolean.difference([plate, funnel_top_cut], engine='manifold')

# Cut 2: grille opening
grille_cut = box(SHAFT, SHAFT - DUCT_H, WALL + 2,
                 tx=MARGIN, ty=MARGIN + DUCT_H, tz=-1)
plate = trimesh.boolean.difference([plate, grille_cut], engine='manifold')
print(f"  Plate: {len(plate.faces)} faces")

# === 2. Collar (goes UP from plate) ===
print("Creating collar...")
collar_outer = rounded_box(DUCT_W, DUCT_H, COLLAR_DEPTH, COLLAR_RADIUS,
                           tx=(PLATE - DUCT_W) / 2, ty=MARGIN, tz=WALL)

# Funnel: narrow at plate (FUNNEL_TOP_W=150), wide at top (FUNNEL_BOT_W=204)
funnel_cut = frustum(
    top_w=FUNNEL_BOT_W, top_h=FUNNEL_H,  # wide at top (collar exit)
    bot_w=FUNNEL_TOP_W, bot_h=FUNNEL_H,  # 170mm at plate level (tapered)
    height=COLLAR_DEPTH + 2,
    cx_=center_x, cy_=center_y,
    tz=WALL - 1
)
collar = trimesh.boolean.difference([collar_outer, funnel_cut], engine='manifold')
print(f"  Collar: {len(collar.faces)} faces")

# === 3. Divider bar ===
print("Creating divider...")
divider = box(SHAFT, WALL, WALL, tx=MARGIN, ty=MARGIN + DUCT_H, tz=0)

# === 4. Grille slats ===
print("Creating grille slats...")
grille_area_h = SHAFT - DUCT_H - WALL   # 87mm
grille_start_y = MARGIN + DUCT_H + WALL  # y=93

n_slats = int((grille_area_h - GRILLE_GAP) / (GRILLE_SLAT + GRILLE_GAP))
actual_gap = (grille_area_h - n_slats * GRILLE_SLAT) / (n_slats + 1)
print(f"  Grille: {grille_area_h:.0f}mm, {n_slats} slats, gap {actual_gap:.1f}mm")

slats = []
for i in range(n_slats):
    y = grille_start_y + actual_gap * (i + 1) + GRILLE_SLAT * i
    slats.append(box(SHAFT, GRILLE_SLAT, WALL, tx=MARGIN, ty=y, tz=0))

# === 5. Glider + DCRM ===
print("Creating Glider + DCRM emblem...")
# Layout:  row 0:   .O.
#          row 1:   DCRM ..O
#          row 2:   OOO
GLIDER_CELLS = [(1,0), (2,1), (0,2), (1,2), (2,2)]

FONT = {
    'D': [
        [1,1,1,0,0],
        [1,0,0,1,0],
        [1,0,0,1,0],
        [1,0,0,1,0],
        [1,1,1,0,0],
    ],
    'C': [
        [0,1,1,1,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [0,1,1,1,0],
    ],
    'R': [
        [1,1,1,0,0],
        [1,0,0,1,0],
        [1,1,1,0,0],
        [1,0,1,0,0],
        [1,0,0,1,0],
    ],
    'M': [
        [1,0,0,0,1],
        [1,1,0,1,1],
        [1,0,1,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
    ],
}
FONT_COLS = 5

# Center glider in bottom margin
comp_cy = MARGIN / 2.0
glider_origin_x = center_x - GLIDER_SPACING  # col 1 at center_x
glider_cell_xy = lambda c, r: (glider_origin_x + c * GLIDER_SPACING,
                                comp_cy + (1 - r) * GLIDER_SPACING)

# Glider squares
glider_bumps = []
for (col, row) in GLIDER_CELLS:
    gx, gy = glider_cell_xy(col, row)
    bump = box(GLIDER_SQ, GLIDER_SQ, GLIDER_H,
               tx=gx - GLIDER_SQ/2, ty=gy - GLIDER_SQ/2, tz=WALL)
    glider_bumps.append(bump)

# DCRM — placed in row 1, to the left of cell (2,1)
text = "DCRM"
cell21_x, cell21_y = glider_cell_xy(2, 1)
letter_px_w = (FONT_COLS - 1) * TEXT_SPACING  # 5 cols → 4 spacings
dcrm_w = len(text) * letter_px_w + (len(text) - 1) * TEXT_LETTER_GAP
gap_to_cell = 1.5
dcrm_right = cell21_x - GLIDER_SQ/2 - gap_to_cell
dcrm_start_x = dcrm_right - dcrm_w

text_bumps = []
for li, ch in enumerate(text):
    lx = dcrm_start_x + li * (letter_px_w + TEXT_LETTER_GAP)
    for row_i, row_data in enumerate(FONT[ch]):
        for col_i, val in enumerate(row_data):
            if val:
                px = lx + col_i * TEXT_SPACING
                py = cell21_y + (2 - row_i) * TEXT_SPACING  # center on row 1
                bump = box(TEXT_PIXEL, TEXT_PIXEL, TEXT_H,
                           tx=px - TEXT_PIXEL/2, ty=py - TEXT_PIXEL/2, tz=WALL)
                text_bumps.append(bump)

print(f"  Glider: {len(glider_bumps)} cells ({GLIDER_SQ}mm), DCRM: {len(text_bumps)} px ({TEXT_PIXEL}mm)")

# === 6. Assemble ===
print("Assembling...")
parts = [plate, collar, divider] + slats + glider_bumps + text_bumps
result = parts[0]
for p in parts[1:]:
    result = trimesh.boolean.union([result, p], engine='manifold')

# === 7. Mounting holes (through entire Z extent) ===
print("Drilling mounting holes...")
z_min = result.bounds[0][2]
z_max = result.bounds[1][2]
hole_h = z_max - z_min + 2

for (hx, hy) in [(HOLE_OFFSET, HOLE_OFFSET),
                  (PLATE - HOLE_OFFSET, HOLE_OFFSET),
                  (HOLE_OFFSET, PLATE - HOLE_OFFSET),
                  (PLATE - HOLE_OFFSET, PLATE - HOLE_OFFSET)]:
    hole = cylinder_z(HOLE_DIA, hole_h, tx=hx, ty=hy, tz=z_min - 1)
    result = trimesh.boolean.difference([result, hole], engine='manifold')

# === 8. Shift model so it sits on z=0 (no flip!) ===
z_shift = -result.bounds[0][2]
if abs(z_shift) > 0.001:
    result.apply_translation([0, 0, z_shift])

print(f"\nFinal: {len(result.faces)} faces, {len(result.vertices)} verts")
print(f"Bounds: {result.bounds[0]} → {result.bounds[1]}")
print(f"Watertight: {result.is_watertight}")

# === Export ===
stl_path = "/home/claude/vent_grille.stl"
result.export(stl_path)
print(f"STL: {stl_path} ({os.path.getsize(stl_path)/1024:.1f} KB)")

scad_path = "/home/claude/vent_grille.scad"
with open(scad_path, 'w') as f:
    f.write(f"""// Ventilation grille — collar UP, decorations on bottom face
// Plate: {PLATE}x{PLATE}x{WALL}mm, Shaft: {SHAFT}x{SHAFT}mm
// Collar: {DUCT_W}x{DUCT_H}mm, depth {COLLAR_DEPTH}mm, R={COLLAR_RADIUS}mm
// Funnel: {FUNNEL_TOP_W}mm → {FUNNEL_BOT_W}mm

$fn = 32;

plate = {PLATE}; shaft = {SHAFT}; wall = {WALL};
duct_w = {DUCT_W}; duct_h = {DUCT_H};
collar_depth = {COLLAR_DEPTH}; collar_r = {COLLAR_RADIUS};
hole_dia = {HOLE_DIA}; hole_offset = {HOLE_OFFSET};
margin = (plate - shaft) / 2;

funnel_top_w = {FUNNEL_TOP_W}; funnel_bot_w = {FUNNEL_BOT_W};
funnel_h = {FUNNEL_H};
center_x = plate / 2; center_y = margin + duct_h / 2;

grille_slat = {GRILLE_SLAT};
grille_start_y = margin + duct_h + wall;
n_slats = {n_slats}; actual_gap = {actual_gap:.2f};

bump_h = {GLIDER_H};
glider_sq = {GLIDER_SQ}; glider_sp = {GLIDER_SPACING};
text_px = {TEXT_PIXEL}; text_sp = {TEXT_SPACING};
letter_gap = {TEXT_LETTER_GAP};

module rounded_rect(w, h, depth, r) {{
    translate([r, r, 0]) minkowski() {{
        cube([w - 2*r, h - 2*r, depth/2]);
        cylinder(r=r, h=depth/2);
    }}
}}

module funnel_shape(top_w, top_h, bot_w, bot_h, height, cx, cy) {{
    hull() {{
        translate([cx - top_w/2, cy - top_h/2, height - 0.01])
            cube([top_w, top_h, 0.01]);
        translate([cx - bot_w/2, cy - bot_h/2, 0])
            cube([bot_w, bot_h, 0.01]);
    }}
}}

// Layout: Glider centered, DCRM in row 1 left of cell (2,1)
glider_ox = center_x - glider_sp;  // col 1 at center
comp_cy = margin / 2;
// Cell (2,1) center x:
cell21_x = glider_ox + 2 * glider_sp;
gap_to_cell = 1.5;
letter_px_w = 4 * text_sp;  // 5 cols
dcrm_w = 4 * letter_px_w + 3 * letter_gap;
dcrm_right = cell21_x - glider_sq/2 - gap_to_cell;
dcrm_sx = dcrm_right - dcrm_w;

difference() {{
    union() {{
        // Plate with openings
        difference() {{
            cube([plate, plate, wall]);
            translate([center_x - funnel_top_w/2, center_y - funnel_h/2, -1])
                cube([funnel_top_w, funnel_h, wall + 2]);
            translate([margin, margin + duct_h, -1])
                cube([shaft, shaft - duct_h, wall + 2]);
        }}

        // Collar (UP from plate)
        translate([(plate - duct_w) / 2, margin, wall])
        difference() {{
            rounded_rect(duct_w, duct_h, collar_depth, collar_r);
            translate([-(plate - duct_w) / 2, -margin, -1])
                funnel_shape(funnel_bot_w, funnel_h, funnel_top_w, funnel_h,
                             collar_depth + 2, center_x, center_y);
        }}

        // Divider bar
        translate([margin, margin + duct_h, 0]) cube([shaft, wall, wall]);

        // Grille slats
        for (i = [0 : n_slats - 1])
            translate([margin, grille_start_y + actual_gap * (i+1) + grille_slat * i, 0])
                cube([shaft, grille_slat, wall]);

        // Glider cells
        glider_cells = [[1,0], [2,1], [0,2], [1,2], [2,2]];
        for (cell = glider_cells) {{
            gx = glider_ox + cell[0] * glider_sp;
            gy = comp_cy + (1 - cell[1]) * glider_sp;
            translate([gx - glider_sq/2, gy - glider_sq/2, wall])
                cube([glider_sq, glider_sq, bump_h]);
        }}

        // DCRM text in row 1
        cell21_y = comp_cy;  // row 1 Y
        d_px = [[0,0],[1,0],[2,0],[0,1],[3,1],[0,2],[3,2],[0,3],[3,3],[0,4],[1,4],[2,4]];
        c_px = [[1,0],[2,0],[3,0],[0,1],[0,2],[0,3],[1,4],[2,4],[3,4]];
        r_px = [[0,0],[1,0],[2,0],[0,1],[3,1],[0,2],[1,2],[2,2],[0,3],[2,3],[0,4],[3,4]];
        m_px = [[0,0],[4,0],[0,1],[1,1],[3,1],[4,1],[0,2],[2,2],[4,2],[0,3],[4,3],[0,4],[4,4]];
        letters = [d_px, c_px, r_px, m_px];
        for (li = [0:3]) {{
            lx = dcrm_sx + li * (letter_px_w + letter_gap);
            for (pi = [0:len(letters[li])-1]) {{
                col = letters[li][pi][0];
                row = letters[li][pi][1];
                px = lx + col * text_sp;
                py = cell21_y + (2 - row) * text_sp;
                translate([px - text_px/2, py - text_px/2, wall])
                    cube([text_px, text_px, bump_h]);
            }}
        }}
    }}

    // Mounting holes
    for (pos = [[hole_offset, hole_offset],
                [plate - hole_offset, hole_offset],
                [hole_offset, plate - hole_offset],
                [plate - hole_offset, plate - hole_offset]])
        translate([pos[0], pos[1], -bump_h - 1])
            cylinder(h = wall + collar_depth + bump_h + 2, d = hole_dia);
}}
""")

print(f"SCAD: {scad_path}")
print("\nDone!")
