// Ventilation grille with duct collar (rounded corners)
// All dimensions in mm
// Shaft: 150.0x150.0, Plate: 210.0x210.0, Wall: 3.0mm
// Duct connection: 150.0x90.0, Collar depth: 30.0mm, Corner R: 5.0mm

$fn = 32;

shaft = 150.0;
plate = 210.0;
wall = 3.0;
duct_w = 150.0;
duct_h = 90.0;
collar_depth = 30.0;
collar_r = 5.0;
hole_dia = 4.0;
hole_offset = 15.0;
margin = (plate - shaft) / 2;

grille_slat = 3.0;
grille_area_h = shaft - duct_h - wall;
grille_start_y = margin + duct_h + wall;
n_slats = 3;
actual_gap = 12.00;

module rounded_rect(w, h, depth, r) {
    translate([r, r, 0])
    minkowski() {
        cube([w - 2*r, h - 2*r, depth/2]);
        cylinder(r=r, h=depth/2);
    }
}

difference() {
    union() {
        // Base plate — cut only collar inner hole + grille zone
        difference() {
            cube([plate, plate, wall]);
            // Collar inner hole (rounded) — air passage
            translate([margin + wall, margin + wall, -1])
                rounded_rect(duct_w - 2*wall, duct_h - 2*wall, wall + 2, max(collar_r - wall, 0.5));
            // Grille opening (straight)
            translate([margin, margin + duct_h, -1])
                cube([shaft, shaft - duct_h, wall + 2]);
        }

        // Collar (rounded, protrudes downward from plate)
        translate([margin, margin, -collar_depth])
        difference() {
            rounded_rect(duct_w, duct_h, collar_depth, collar_r);
            translate([wall, wall, -1])
                rounded_rect(duct_w - 2*wall, duct_h - 2*wall, collar_depth + 2, max(collar_r - wall, 0.5));
        }

        // Divider bar between duct and grille
        translate([margin, margin + duct_h, 0])
            cube([shaft, wall, wall]);

        // Grille slats
        for (i = [0 : n_slats - 1]) {
            translate([margin, grille_start_y + actual_gap * (i + 1) + grille_slat * i, 0])
                cube([shaft, grille_slat, wall]);
        }
    }

    // Mounting holes (4x corners)
    for (pos = [[hole_offset, hole_offset],
                [plate - hole_offset, hole_offset],
                [hole_offset, plate - hole_offset],
                [plate - hole_offset, plate - hole_offset]]) {
        translate([pos[0], pos[1], -1])
            cylinder(h = wall + 2, d = hole_dia);
    }
}
