/* =============================================================================
   AI4Mobility — Pose Renderer
   -----------------------------------------------------------------------------
   Draws a stick-figure for each named pose as inline SVG.

   HONEST STATEMENT OF METHOD:
   These are HAND-AUTHORED joint coordinates, not the output of a pose
   estimation model. They use the same skeleton connection list and the same
   drawing logic as the MediaPipe-derived figures in the notebook, so the visual
   language is consistent, but no landmark detection is running here.

   Live pose detection from a camera is a separate, optional feature in app.js
   and is clearly labelled there.

   Coordinate frame: viewBox 0 0 220 150, y increases downward (image
   convention, matching the raw landmark data). Floor is drawn at y = 134.
   ============================================================================= */

(function (global) {
  'use strict';

  const FLOOR_Y = 134;

  // Skeleton connection list — the same joint pairs used in the notebook.
  const LIMBS = [
    ['neck', 'sho'],
    ['sho', 'elb'], ['elb', 'wri'],
    ['sho', 'elb2'], ['elb2', 'wri2'],
    ['hip', 'kne'], ['kne', 'ank'], ['ank', 'toe'],
    ['hip', 'kne2'], ['kne2', 'ank2'], ['ank2', 'toe2'],
    ['wri', 'hand'], ['wri2', 'hand2']
  ];

  /* ------------------------------------------------------------- pose bank */

  const P = {
    /* ---- standing ---- */
    stand: {
      label: 'Standing tall',
      j: { head: [110, 26], neck: [110, 38], sho: [110, 46], hip: [110, 84],
           elb: [101, 66], wri: [98, 88], elb2: [119, 66], wri2: [122, 88],
           kne: [106, 108], ank: [104, 130], toe: [114, 134],
           kne2: [114, 108], ank2: [116, 130], toe2: [126, 134] }
    },
    heel_raise: {
      label: 'Up on tiptoes',
      j: { head: [110, 20], neck: [110, 32], sho: [110, 40], hip: [110, 78],
           elb: [101, 60], wri: [98, 82], elb2: [119, 60], wri2: [122, 82],
           kne: [106, 102], ank: [104, 122], toe: [118, 134],
           kne2: [114, 102], ank2: [116, 122], toe2: [128, 134] },
      arrows: [[110, 60, 110, 40]]
    },
    one_leg: {
      label: 'Balancing on one leg',
      j: { head: [110, 26], neck: [110, 38], sho: [110, 46], hip: [110, 84],
           elb: [94, 64], wri: [84, 78], elb2: [126, 64], wri2: [136, 78],
           kne: [110, 108], ank: [110, 130], toe: [120, 134],
           kne2: [130, 92], ank2: [126, 112], toe2: [136, 116] }
    },
    hip_hitch: {
      label: 'Hip lifted towards the shoulder',
      j: { head: [110, 26], neck: [110, 38], sho: [110, 46], hip: [110, 84],
           elb: [100, 66], wri: [98, 88], elb2: [120, 66], wri2: [122, 88],
           kne: [104, 108], ank: [104, 130], toe: [114, 134],
           kne2: [122, 100], ank2: [124, 122], toe2: [134, 126] },
      arrows: [[126, 92, 126, 76]]
    },

    /* ---- kneeling / child's pose ---- */
    kneel: {
      label: 'Kneeling tall',
      floorY: 134,
      j: { head: [104, 44], neck: [104, 56], sho: [104, 64], hip: [104, 100],
           elb: [94, 82], wri: [92, 104], elb2: [114, 82], wri2: [116, 104],
           kne: [104, 132], ank: [128, 133], toe: [140, 132],
           kne2: [110, 132], ank2: [134, 133], toe2: [146, 132] }
    },
    sit_heels: {
      label: 'Sitting back on your heels',
      j: { head: [116, 66], neck: [116, 78], sho: [116, 86], hip: [116, 116],
           elb: [106, 100], wri: [102, 116], elb2: [126, 100], wri2: [130, 116],
           kne: [96, 130], ank: [126, 132], toe: [136, 133],
           kne2: [92, 130], ank2: [122, 132], toe2: [132, 133] }
    },
    fold: {
      label: 'Folding forward',
      floorY: 138,
      j: { head: [86, 128], neck: [98, 126], sho: [108, 124], hip: [148, 118],
           elb: [98, 132], wri: [84, 135],
           kne: [122, 136], ank: [152, 137], toe: [162, 137],
           kne2: [118, 136], ank2: [148, 137], toe2: [158, 137] },
      spineCtrl: [126, 130]
    },
    arms_long: {
      label: "Child's Pose — long arms, sleepy head",
      floorY: 138,
      j: { head: [92, 128], neck: [104, 126], sho: [114, 124], hip: [152, 118],
           elb: [82, 132], wri: [50, 136],
           kne: [126, 136], ank: [156, 137], toe: [166, 137],
           kne2: [122, 136], ank2: [152, 137], toe2: [162, 137] },
      spineCtrl: [132, 130]
    },

    /* ---- quadruped family ---- */
    table: {
      label: 'Hands and knees — a strong table',
      j: { head: [66, 88], neck: [78, 92], sho: [86, 92], hip: [140, 92],
           elb: [86, 110], wri: [86, 130], elb2: [92, 110], wri2: [92, 130],
           kne: [140, 112], ank: [140, 130], toe: [150, 132],
           kne2: [146, 112], ank2: [146, 130], toe2: [156, 132] }
    },
    cow: {
      label: 'Cow — tummy drops, chest lifts',
      j: { head: [62, 78], neck: [74, 84], sho: [86, 88], hip: [140, 90],
           elb: [86, 108], wri: [86, 130], elb2: [92, 108], wri2: [92, 130],
           kne: [140, 112], ank: [140, 130], toe: [150, 132],
           kne2: [146, 112], ank2: [146, 130], toe2: [156, 132] },
      spineCtrl: [113, 108],
      arrows: [[113, 92, 113, 106]]
    },
    cat: {
      label: 'Cat — back rounds up, chin tucks',
      j: { head: [70, 108], neck: [80, 100], sho: [88, 94], hip: [140, 94],
           elb: [88, 112], wri: [88, 130], elb2: [94, 112], wri2: [94, 130],
           kne: [140, 112], ank: [140, 130], toe: [150, 132],
           kne2: [146, 112], ank2: [146, 130], toe2: [156, 132] },
      spineCtrl: [114, 74],
      arrows: [[114, 88, 114, 72]]
    },
    flow: {
      label: 'Flowing between Cat and Cow',
      alias: 'cow', animateWith: 'cat'
    },
    quadruped_leg: {
      label: 'One leg stretched straight behind',
      j: { head: [66, 88], neck: [78, 92], sho: [86, 92], hip: [140, 92],
           elb: [86, 110], wri: [86, 130], elb2: [92, 110], wri2: [92, 130],
           kne: [140, 112], ank: [140, 130], toe: [150, 132],
           kne2: [166, 86], ank2: [192, 82], toe2: [202, 86] },
      arrows: [[170, 96, 194, 88]]
    },

    /* ---- thread the needle ---- */
    thread_start: {
      label: 'Hand starting to slide through',
      j: { head: [66, 90], neck: [78, 94], sho: [86, 94], hip: [140, 92],
           elb: [92, 114], wri: [110, 130], elb2: [92, 110], wri2: [92, 130],
           kne: [140, 112], ank: [140, 130], toe: [150, 132],
           kne2: [146, 112], ank2: [146, 130], toe2: [156, 132] },
      arrows: [[96, 122, 116, 130]]
    },
    thread: {
      label: 'Shoulder and cheek resting on the floor',
      floorY: 136,
      j: { head: [72, 126], neck: [86, 122], sho: [98, 118], hip: [150, 96],
           elb: [80, 132], wri: [48, 135], elb2: [106, 120], wri2: [108, 134],
           kne: [150, 116], ank: [150, 134], toe: [162, 135],
           kne2: [156, 116], ank2: [156, 134], toe2: [168, 135] }
    },
    thread_reach: {
      label: 'Top arm reaching to the sky',
      floorY: 136,
      j: { head: [72, 126], neck: [86, 122], sho: [98, 118], hip: [150, 96],
           elb: [80, 132], wri: [48, 135], elb2: [112, 96], wri2: [122, 68],
           kne: [150, 116], ank: [150, 134], toe: [162, 135],
           kne2: [156, 116], ank2: [156, 134], toe2: [168, 135] },
      arrows: [[130, 84, 132, 62]]
    },
    thread_mirror: {
      label: 'Now the other side',
      alias: 'thread_reach', flip: true
    },

    /* ---- lying on the back ---- */
    supine_ankle: {
      label: 'On your back — pointing and pulling the foot',
      floorY: 126,
      j: { head: [54, 112], neck: [66, 112], sho: [78, 112], hip: [120, 112],
           elb: [92, 100], wri: [110, 104],
           kne: [148, 112], ank: [176, 112], toe: [188, 100],
           kne2: [148, 118], ank2: [176, 118], toe2: [190, 124] },
      arrows: [[196, 120, 196, 100]]
    },
    supine_quad: {
      label: 'Pressing the knee down firmly',
      floorY: 126,
      j: { head: [54, 112], neck: [66, 112], sho: [78, 112], hip: [120, 112],
           elb: [92, 100], wri: [110, 104],
           kne: [148, 112], ank: [176, 112], toe: [188, 100],
           kne2: [148, 118], ank2: [176, 118], toe2: [190, 108] },
      arrows: [[148, 92, 148, 108]]
    },
    supine_glute: {
      label: 'On your back, squeezing',
      floorY: 126,
      j: { head: [54, 112], neck: [66, 112], sho: [78, 112], hip: [120, 112],
           elb: [92, 100], wri: [110, 104],
           kne: [148, 112], ank: [176, 112], toe: [188, 102],
           kne2: [148, 118], ank2: [176, 118], toe2: [190, 110] },
      pulse: [122, 112]
    },
    knee_bend: {
      label: 'Heel sliding towards your bottom',
      floorY: 126,
      j: { head: [54, 112], neck: [66, 112], sho: [78, 112], hip: [120, 112],
           elb: [92, 100], wri: [108, 104],
           kne: [150, 86], ank: [132, 104], toe: [124, 112],
           kne2: [152, 118], ank2: [180, 118], toe2: [190, 110] },
      arrows: [[168, 104, 150, 90]]
    },
    hip_abduct: {
      label: 'Leg sliding out to the side',
      floorY: 128,
      j: { head: [54, 114], neck: [66, 114], sho: [78, 114], hip: [120, 114],
           elb: [92, 102], wri: [108, 106],
           kne: [148, 118], ank: [176, 118], toe: [188, 112],
           kne2: [148, 94], ank2: [174, 82], toe2: [184, 76] },
      arrows: [[152, 112, 176, 88]]
    },
    bridge: {
      label: 'Hips lifted into a bridge',
      floorY: 132,
      j: { head: [54, 120], neck: [66, 120], sho: [78, 118], hip: [122, 92],
           elb: [86, 126], wri: [104, 129],
           kne: [150, 100], ank: [150, 128], toe: [164, 131],
           kne2: [156, 100], ank2: [156, 128], toe2: [170, 131] },
      spineCtrl: [98, 100],
      arrows: [[104, 122, 104, 101]]
    },
    dead_bug: {
      label: 'Dead Bug — opposite arm and leg',
      floorY: 130,
      j: { head: [54, 118], neck: [66, 118], sho: [78, 118], hip: [122, 118],
           elb: [80, 96], wri: [84, 72], elb2: [60, 108], wri2: [38, 100],
           kne: [122, 92], ank: [150, 92], toe: [160, 82],
           kne2: [152, 112], ank2: [178, 120], toe2: [188, 114] },
      arrows: [[40, 110, 26, 102], [174, 108, 186, 120]]
    },

    /* ---- lying on the tummy / side ---- */
    prone: {
      label: 'Resting on your tummy',
      floorY: 128,
      j: { head: [56, 114], neck: [68, 114], sho: [78, 114], hip: [120, 114],
           elb: [58, 104], wri: [36, 102],
           kne: [148, 114], ank: [176, 114], toe: [190, 120],
           kne2: [148, 120], ank2: [176, 120], toe2: [190, 126] }
    },
    prone_hip_ext: {
      label: 'Foot pressing up towards the ceiling',
      floorY: 128,
      j: { head: [56, 116], neck: [68, 116], sho: [78, 116], hip: [120, 116],
           elb: [58, 106], wri: [36, 104],
           kne: [148, 116], ank: [148, 86], toe: [162, 82],
           kne2: [154, 122], ank2: [182, 122], toe2: [192, 128] },
      arrows: [[158, 104, 158, 80]]
    },
    bridge_leg_lift: {
      label: 'Bridge with one leg straightened',
      floorY: 132,
      j: { head: [54, 120], neck: [66, 120], sho: [78, 118], hip: [122, 92],
           elb: [86, 126], wri: [104, 129],
           kne: [150, 100], ank: [150, 128], toe: [164, 131],
           kne2: [162, 88], ank2: [188, 82], toe2: [198, 86] },
      spineCtrl: [98, 100],
      arrows: [[104, 122, 104, 101], [166, 98, 190, 88]]
    },
    thigh_lift: {
      label: 'Thigh lifted from lying on the front',
      floorY: 128,
      j: { head: [56, 116], neck: [68, 116], sho: [78, 116], hip: [120, 116],
           elb: [58, 106], wri: [36, 104],
           kne: [150, 104], ank: [150, 78], toe: [164, 74],
           kne2: [154, 122], ank2: [182, 122], toe2: [192, 128] },
      arrows: [[136, 118, 146, 102]]
    },
    step_up: {
      label: 'Stepping up onto a step',
      floorY: 134,
      j: { head: [98, 24], neck: [98, 36], sho: [98, 44], hip: [100, 82],
           elb: [88, 64], wri: [86, 86], elb2: [108, 64], wri2: [110, 86],
           kne: [120, 96], ank: [124, 112], toe: [136, 114],
           kne2: [96, 106], ank2: [94, 128], toe2: [106, 132] },
      arrows: [[112, 104, 124, 92]],
      props: [[112, 114, 152, 134]]
    },
    chair_squat: {
      label: 'Lowering towards a chair',
      floorY: 134,
      j: { head: [96, 40], neck: [98, 52], sho: [100, 60], hip: [112, 94],
           elb: [86, 70], wri: [72, 78], elb2: [104, 70], wri2: [90, 80],
           kne: [96, 108], ank: [98, 130], toe: [110, 133],
           kne2: [102, 108], ank2: [104, 130], toe2: [116, 133] },
      arrows: [[126, 86, 126, 104]],
      props: [[112, 100, 152, 134]]
    },
    soleus_raise: {
      label: 'Heel raise with the knee bent',
      floorY: 134,
      j: { head: [104, 26], neck: [104, 38], sho: [104, 46], hip: [102, 84],
           elb: [116, 60], wri: [130, 62], elb2: [94, 64], wri2: [92, 86],
           kne: [112, 106], ank: [104, 122], toe: [118, 133],
           kne2: [118, 100], ank2: [116, 116], toe2: [128, 120] },
      arrows: [[98, 128, 98, 112]],
      props: [[136, 20, 144, 134]]
    },
    tandem_stand: {
      label: 'Heel-to-toe standing',
      floorY: 134,
      j: { head: [110, 26], neck: [110, 38], sho: [110, 46], hip: [110, 84],
           elb: [96, 64], wri: [86, 76], elb2: [124, 64], wri2: [134, 76],
           kne: [104, 108], ank: [100, 130], toe: [112, 133],
           kne2: [116, 108], ank2: [120, 130], toe2: [132, 133] }
    },
    heel_toe_walk: {
      label: 'Walking heel to toe in a line',
      floorY: 134,
      j: { head: [102, 26], neck: [102, 38], sho: [102, 46], hip: [104, 84],
           elb: [88, 62], wri: [74, 70], elb2: [120, 62], wri2: [134, 70],
           kne: [94, 108], ank: [90, 130], toe: [102, 133],
           kne2: [122, 104], ank2: [130, 126], toe2: [144, 130] },
      arrows: [[112, 128, 136, 124]]
    },
    seated: {
      label: 'Sitting tall in a chair',
      floorY: 136,
      j: { head: [96, 30], neck: [96, 42], sho: [96, 50], hip: [96, 86],
           elb: [86, 68], wri: [84, 88], elb2: [106, 68], wri2: [108, 88],
           kne: [128, 88], ank: [130, 116], toe: [142, 134],
           kne2: [128, 94], ank2: [130, 122], toe2: [142, 135] },
      props: [[92, 86, 132, 90], [88, 40, 96, 90], [126, 90, 132, 134]]
    },
    shoulder_roll: {
      label: 'Rolling the shoulders',
      floorY: 136,
      j: { head: [96, 30], neck: [96, 42], sho: [96, 50], hip: [96, 86],
           elb: [82, 62], wri: [80, 84], elb2: [110, 62], wri2: [112, 84],
           kne: [128, 88], ank: [130, 116], toe: [142, 134],
           kne2: [128, 94], ank2: [130, 122], toe2: [142, 135] },
      arrows: [[80, 44, 96, 36]],
      props: [[92, 86, 132, 90], [88, 40, 96, 90], [126, 90, 132, 134]]
    },
    seated_reach: {
      label: 'Reaching both arms overhead',
      floorY: 136,
      j: { head: [96, 34], neck: [96, 46], sho: [96, 54], hip: [96, 88],
           elb: [88, 28], wri: [84, 4], elb2: [106, 28], wri2: [110, 4],
           kne: [128, 90], ank: [130, 118], toe: [142, 134],
           kne2: [128, 96], ank2: [130, 124], toe2: [142, 135] },
      arrows: [[118, 20, 120, 2]],
      props: [[92, 88, 132, 92], [88, 44, 96, 92], [126, 92, 132, 134]]
    },
    neck_stretch: {
      label: 'Gentle neck side stretch',
      floorY: 136,
      j: { head: [84, 32], neck: [96, 44], sho: [96, 52], hip: [96, 88],
           elb: [86, 70], wri: [84, 90], elb2: [106, 70], wri2: [108, 90],
           kne: [128, 90], ank: [130, 118], toe: [142, 134],
           kne2: [128, 96], ank2: [130, 124], toe2: [142, 135] },
      arrows: [[92, 24, 76, 28]],
      props: [[92, 88, 132, 92], [88, 42, 96, 92], [126, 92, 132, 134]]
    },
    seated_twist: {
      label: 'Turning the shoulders to look behind',
      floorY: 136,
      j: { head: [104, 32], neck: [98, 44], sho: [98, 52], hip: [96, 88],
           elb: [112, 66], wri: [122, 82], elb2: [84, 64], wri2: [96, 76],
           kne: [128, 90], ank: [130, 118], toe: [142, 134],
           kne2: [128, 96], ank2: [130, 124], toe2: [142, 135] },
      arrows: [[110, 24, 126, 30]],
      props: [[92, 88, 132, 92], [88, 42, 96, 92], [126, 92, 132, 134]]
    },
    wrist_table: {
      // close-up of the forearm only: a head and torso at this scale read as a
      // person lying down rather than as a hand exercise
      label: 'Forearm resting on a table, wrist bending up and down',
      floorY: 0,
      j: { sho: [26, 40], elb: [64, 76], wri: [132, 84], hand: [174, 56] },
      arrows: [[156, 96, 172, 62]],
      props: [[52, 90, 198, 98]]
    },
    wrist_side: {
      label: 'Wrist moving from side to side',
      floorY: 0,
      j: { sho: [26, 40], elb: [64, 76], wri: [132, 84], hand: [178, 68] },
      arrows: [[172, 46, 186, 92]],
      props: [[52, 90, 198, 98]]
    },
    forearm_twist: {
      label: 'Elbow at the side, turning the palm',
      floorY: 134,
      j: { head: [96, 26], neck: [96, 38], sho: [96, 46], hip: [96, 84],
           elb: [92, 68], wri: [136, 66], elb2: [102, 68], wri2: [140, 74],
           kne: [92, 106], ank: [92, 130], toe: [104, 133],
           kne2: [100, 106], ank2: [100, 130], toe2: [112, 133] },
      arrows: [[152, 56, 156, 82]]
    },
    palm_stretch: {
      label: 'The other hand eases the wrist back',
      floorY: 0,
      j: { sho: [22, 54], elb: [64, 82], wri: [130, 78], hand: [156, 34],
           elb2: [72, 126], wri2: [128, 106], hand2: [150, 66] },
      arrows: [[172, 62, 178, 32]]
    },
    hand_back_stretch: {
      label: 'The other hand eases the wrist down',
      floorY: 0,
      j: { sho: [22, 44], elb: [64, 72], wri: [130, 80], hand: [156, 124],
           elb2: [72, 20], wri2: [128, 50], hand2: [150, 92] },
      arrows: [[172, 96, 178, 126]]
    },
    prayer_stretch: {
      label: 'Palms together in front of the chest',
      floorY: 134,
      j: { head: [96, 26], neck: [96, 38], sho: [96, 46], hip: [96, 84],
           elb: [78, 62], wri: [110, 56], elb2: [114, 62], wri2: [110, 60],
           kne: [92, 106], ank: [92, 130], toe: [104, 133],
           kne2: [100, 106], ank2: [100, 130], toe2: [112, 133] },
      arrows: [[124, 44, 124, 62]]
    },
    wall_push: {
      label: 'Hands flat against a wall',
      floorY: 134,
      j: { head: [86, 34], neck: [88, 46], sho: [90, 54], hip: [82, 90],
           elb: [116, 58], wri: [146, 62], elb2: [116, 66], wri2: [146, 70],
           kne: [78, 108], ank: [76, 130], toe: [88, 133],
           kne2: [86, 108], ank2: [84, 130], toe2: [96, 133] },
      arrows: [[130, 88, 148, 88]],
      props: [[150, 14, 156, 134]]
    },
    clam: {
      label: 'Side lying — knee opens like a clam',
      floorY: 138,
      j: { head: [54, 108], neck: [66, 110], sho: [78, 110], hip: [122, 112],
           elb: [92, 98], wri: [110, 94],
           kne: [146, 126], ank: [122, 136], toe: [110, 134],
           kne2: [150, 96], ank2: [124, 114], toe2: [112, 114] },
      arrows: [[156, 118, 160, 96]]
    }
  };

  /* -------------------------------------------------------------- helpers */

  function esc(n) { return Math.round(n * 100) / 100; }

  function line(a, b, cls) {
    return `<line x1="${esc(a[0])}" y1="${esc(a[1])}" x2="${esc(b[0])}" y2="${esc(b[1])}" class="${cls}"/>`;
  }

  function arrow(a) {
    const [x1, y1, x2, y2] = a;
    return `<line x1="${esc(x1)}" y1="${esc(y1)}" x2="${esc(x2)}" y2="${esc(y2)}" class="pf-arrow" marker-end="url(#pf-head)"/>`;
  }

  function resolve(key) {
    let pose = P[key];
    if (!pose) return null;
    let flip = !!pose.flip;
    let animateWith = pose.animateWith || null;
    while (pose && pose.alias) {
      const next = P[pose.alias];
      if (!next) break;
      animateWith = animateWith || pose.animateWith || null;
      pose = Object.assign({}, next, {
        label: pose.label || next.label,
        arrows: pose.arrows || next.arrows
      });
    }
    return { pose, flip, animateWith };
  }

  /* ------------------------------------------------------------- renderer */

  /**
   * Render a pose as an SVG string.
   * @param {string} key    pose key from the bank
   * @param {object} opts   { animate:boolean, showFloor:boolean, title:string }
   */
  function render(key, opts) {
    const o = Object.assign({ animate: true, showFloor: true, title: '' }, opts || {});
    const found = resolve(key);

    if (!found) {
      return `<svg viewBox="0 0 220 150" class="posefig" role="img" aria-label="No picture available">
        <text x="110" y="78" text-anchor="middle" class="pf-missing">no picture yet</text></svg>`;
    }

    const { pose, flip, animateWith } = found;
    const j = pose.j;
    const title = o.title || pose.label || '';

    // ---- automatic framing -------------------------------------------------
    // Compute a tight bounding box over everything that will be drawn, so every
    // pose fills its frame consistently instead of floating in white space.
    // floorY === 0 means this pose has no ground plane (a close-up view).
    const floorY = pose.floorY != null ? pose.floorY : FLOOR_Y;
    const drawFloor = o.showFloor && floorY !== 0;
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    function extend(x, y, r) {
      r = r || 0;
      box.x0 = Math.min(box.x0, x - r); box.x1 = Math.max(box.x1, x + r);
      box.y0 = Math.min(box.y0, y - r); box.y1 = Math.max(box.y1, y + r);
    }
    Object.keys(j).forEach(k => extend(j[k][0], j[k][1], k === 'head' ? 10.5 : 3.5));
    if (pose.spineCtrl) extend(pose.spineCtrl[0], pose.spineCtrl[1]);
    (pose.arrows || []).forEach(a => { extend(a[0], a[1]); extend(a[2], a[3]); });
    if (pose.pulse) extend(pose.pulse[0], pose.pulse[1], 16);
    (pose.props || []).forEach(r => { extend(r[0], r[1]); extend(r[2], r[3]); });
    if (drawFloor) { extend(box.x0, floorY); extend(box.x1, floorY); }

    const PAD = 12;
    box.x0 -= PAD; box.x1 += PAD; box.y0 -= PAD; box.y1 += PAD;

    // Keep the aspect ratio in a sensible band so card heights stay stable.
    let w = box.x1 - box.x0, h = box.y1 - box.y0;
    const MIN_AR = 1.25, MAX_AR = 2.30;
    if (w / h > MAX_AR) { const need = w / MAX_AR - h; box.y0 -= need / 2; box.y1 += need / 2; }
    else if (w / h < MIN_AR) { const need = h * MIN_AR - w; box.x0 -= need / 2; box.x1 += need / 2; }
    w = box.x1 - box.x0; h = box.y1 - box.y0;
    const VB = `${esc(box.x0)} ${esc(box.y0)} ${esc(w)} ${esc(h)}`;

    let body = '';

    // props (chair, wall, step, table) drawn behind the figure
    (pose.props || []).forEach(r => {
      body += '<rect x="' + esc(Math.min(r[0], r[2])) + '" y="' + esc(Math.min(r[1], r[3])) +
              '" width="' + esc(Math.abs(r[2] - r[0])) + '" height="' + esc(Math.abs(r[3] - r[1])) +
              '" class="pf-prop"/>';
    });

    // floor — drawn only across the figure, not the whole canvas
    if (drawFloor) {
      body += `<line x1="${esc(box.x0 + 4)}" y1="${floorY}" x2="${esc(box.x1 - 4)}" y2="${floorY}" class="pf-floor"/>`;
    }

    // spine: straight, or curved when a control point is given
    if (j.neck && j.hip) {
      if (pose.spineCtrl) {
        body += `<path d="M ${esc(j.neck[0])} ${esc(j.neck[1])} Q ${esc(pose.spineCtrl[0])} ${esc(pose.spineCtrl[1])} ${esc(j.hip[0])} ${esc(j.hip[1])}" class="pf-bone pf-spine"/>`;
      } else {
        body += line(j.neck, j.hip, 'pf-bone pf-spine');
      }
    }

    // far-side limbs first (drawn lighter, for depth)
    LIMBS.forEach(([a, b]) => {
      if (!j[a] || !j[b]) return;
      const far = /2$/.test(a) || /2$/.test(b);
      if (far) body += line(j[a], j[b], 'pf-bone pf-far');
    });
    LIMBS.forEach(([a, b]) => {
      if (!j[a] || !j[b]) return;
      const far = /2$/.test(a) || /2$/.test(b);
      if (!far) body += line(j[a], j[b], 'pf-bone');
    });

    // head
    if (j.head) {
      body += `<circle cx="${esc(j.head[0])}" cy="${esc(j.head[1])}" r="9.5" class="pf-head"/>`;
    }

    // joints
    Object.keys(j).forEach(k => {
      if (k === 'head') return;
      const far = /2$/.test(k);
      body += `<circle cx="${esc(j[k][0])}" cy="${esc(j[k][1])}" r="${far ? 2.4 : 3.1}" class="pf-joint${far ? ' pf-far' : ''}"/>`;
    });

    // movement arrows
    (pose.arrows || []).forEach(a => { body += arrow(a); });

    // pulse marker for isometric holds (a squeeze with no visible movement)
    if (pose.pulse) {
      body += `<circle cx="${esc(pose.pulse[0])}" cy="${esc(pose.pulse[1])}" r="10" class="pf-pulse"/>`;
    }

    const transform = flip
      ? ` transform="translate(${esc(box.x0 + box.x1)},0) scale(-1,1)"`
      : '';

    // two-phase animation (cat <-> cow) by cross-fading a second figure
    let second = '';
    if (o.animate && animateWith && P[animateWith]) {
      const alt = render(animateWith, { animate: false, showFloor: false, title: '', rawGroup: true });
      second = `<g class="pf-phase-b">${alt}</g>`;
      body = `<g class="pf-phase-a">${body}</g>`;
    }

    // When embedded inside another figure, return the drawing only — the parent
    // owns the viewBox, so a nested <svg> would rescale and misalign it.
    if (o.rawGroup) return body;

    return `<svg viewBox="${VB}" class="posefig${o.animate ? ' pf-animated' : ''}" role="img" aria-label="${escapeAttr(title)}">

  <defs>
    <marker id="pf-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" class="pf-arrowhead"/>
    </marker>
  </defs>
  <g${transform}>${body}${second}</g>
</svg>`;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function has(key) { return !!P[key]; }
  function keys() { return Object.keys(P); }

  const api = { render, has, keys, FLOOR_Y, LIMBS, _bank: P };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AI4MPoses = api;

})(typeof window !== 'undefined' ? window : globalThis);
