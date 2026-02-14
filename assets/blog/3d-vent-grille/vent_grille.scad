// Ventilation grille — collar UP, decorations on bottom face
// Plate: 210.0x210.0x3.0mm, Shaft: 150.0x150.0mm
// Collar: 204.0x60.0mm, depth 30.0mm, R=5.0mm
// Funnel: 150.0mm → 198.0mm

$fn = 32;

plate = 210.0; shaft = 150.0; wall = 3.0;
duct_w = 204.0; duct_h = 60.0;
collar_depth = 30.0; collar_r = 5.0;
hole_dia = 4.0; hole_offset = 15.0;
margin = (plate - shaft) / 2;

funnel_top_w = 150.0; funnel_bot_w = 198.0;
funnel_h = 54.0;
center_x = plate / 2; center_y = margin + duct_h / 2;

grille_slat = 3.0;
grille_start_y = margin + duct_h + wall;
n_slats = 5; actual_gap = 12.00;

bump_h = 1.2;
glider_sq = 7.0; glider_sp = 10.0;
text_px = 0.95; text_sp = 0.95;
letter_gap = 1.0;

module rounded_rect(w, h, depth, r) {
    translate([r, r, 0]) minkowski() {
        cube([w - 2*r, h - 2*r, depth/2]);
        cylinder(r=r, h=depth/2);
    }
}

module funnel_shape(top_w, top_h, bot_w, bot_h, height, cx, cy) {
    hull() {
        translate([cx - top_w/2, cy - top_h/2, height - 0.01])
            cube([top_w, top_h, 0.01]);
        translate([cx - bot_w/2, cy - bot_h/2, 0])
            cube([bot_w, bot_h, 0.01]);
    }
}

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

difference() {
    union() {
        // Plate with openings
        difference() {
            cube([plate, plate, wall]);
            translate([center_x - funnel_top_w/2, center_y - funnel_h/2, -1])
                cube([funnel_top_w, funnel_h, wall + 2]);
            translate([margin, margin + duct_h, -1])
                cube([shaft, shaft - duct_h, wall + 2]);
        }

        // Collar (UP from plate)
        translate([(plate - duct_w) / 2, margin, wall])
        difference() {
            rounded_rect(duct_w, duct_h, collar_depth, collar_r);
            translate([-(plate - duct_w) / 2, -margin, -1])
                funnel_shape(funnel_bot_w, funnel_h, funnel_top_w, funnel_h,
                             collar_depth + 2, center_x, center_y);
        }

        // Divider bar
        translate([margin, margin + duct_h, 0]) cube([shaft, wall, wall]);

        // Grille slats
        for (i = [0 : n_slats - 1])
            translate([margin, grille_start_y + actual_gap * (i+1) + grille_slat * i, 0])
                cube([shaft, grille_slat, wall]);

        // Glider cells
        glider_cells = [[1,0], [2,1], [0,2], [1,2], [2,2]];
        for (cell = glider_cells) {
            gx = glider_ox + cell[0] * glider_sp;
            gy = comp_cy + (1 - cell[1]) * glider_sp;
            translate([gx - glider_sq/2, gy - glider_sq/2, wall])
                cube([glider_sq, glider_sq, bump_h]);
        }

        // DCRM text in row 1
        cell21_y = comp_cy;  // row 1 Y
        d_px = [[0,0],[1,0],[2,0],[0,1],[3,1],[0,2],[3,2],[0,3],[3,3],[0,4],[1,4],[2,4]];
        c_px = [[1,0],[2,0],[3,0],[0,1],[0,2],[0,3],[1,4],[2,4],[3,4]];
        r_px = [[0,0],[1,0],[2,0],[0,1],[3,1],[0,2],[1,2],[2,2],[0,3],[2,3],[0,4],[3,4]];
        m_px = [[0,0],[4,0],[0,1],[1,1],[3,1],[4,1],[0,2],[2,2],[4,2],[0,3],[4,3],[0,4],[4,4]];
        letters = [d_px, c_px, r_px, m_px];
        for (li = [0:3]) {
            lx = dcrm_sx + li * (letter_px_w + letter_gap);
            for (pi = [0:len(letters[li])-1]) {
                col = letters[li][pi][0];
                row = letters[li][pi][1];
                px = lx + col * text_sp;
                py = cell21_y + (2 - row) * text_sp;
                translate([px - text_px/2, py - text_px/2, wall])
                    cube([text_px, text_px, bump_h]);
            }
        }
    }

    // Mounting holes
    for (pos = [[hole_offset, hole_offset],
                [plate - hole_offset, hole_offset],
                [hole_offset, plate - hole_offset],
                [plate - hole_offset, plate - hole_offset]])
        translate([pos[0], pos[1], -bump_h - 1])
            cylinder(h = wall + collar_depth + bump_h + 2, d = hole_dia);
}
