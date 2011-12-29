const Gettext = imports.gettext;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;

/**
 * load the moveWindow.js file
 *
 * const Extension = imports.ui.extensionSystem.extensions["putWindow@clemens.lab21.org"];
 * const MoveWindow = Extension.moveWindow;
 **/

/**
 * Handles all keybinding stuff and moving windows.
 * Binds following keyboard shortcuts:
 *  - run_command_1 to "Open SimpleMenu"
 *  - move_to_side_n/e/s/w move and resize windows
 *  - move_to_corner_ne/se/sw/nw move an resize to the corners
 *
 **/
function MoveWindow() {
  this._init();
};

MoveWindow.prototype = {

  // private variables
  _keyBindingHandlers: [],
  _bindings: [],
  _shellwm: global.window_manager,

  _topBarHeight: 26,
    
  _primary: 0,
  _screens: [],

  /**
   * Helper functions to takeover binding when enabled and release them
   * on disbale. Will change when 3.4 is available and extensions can register
   * bindings.
   */
  _addKeyBinding: function(keybinding, handler) {
    if (this._keyBindingHandlers[keybinding])
      this._shellwm.disconnect(this._keyBindingHandlers[keybinding]);
    else {
      this._shellwm.takeover_keybinding(keybinding);
      this._bindings[this._bindings.length] = keybinding;
    }

    this._keyBindingHandlers[keybinding] =
        this._shellwm.connect('keybinding::' + keybinding, handler);
  },
  
  _thirdsE : function(win, where, x, y, width1, width2, width3, height) {
    if(win.last_move == where) {
	    this._resize(win, width3, y, width2, height)
      win.last_move = where + where;
    } else if (win.last_move == (where + where)) {
	    this._resize(win, width2, y, width3, height)
      win.last_move = (where+where+where);
    } else {
	    this._resize(win, x, y, width1, height)
      win.last_move = where;
    }
  },
  _thirdsW : function(win, where, x, y, width1, width2, width3, height) {
    if(win.last_move == where) {
	    this._resize(win, x, y, width2, height)
      win.last_move = where + where;
    } else if (win.last_move == (where + where)) {
	    this._resize(win, x, y, width3, height)
      win.last_move = (where+where+where);
    } else {
	    this._resize(win, x, y, width1, height)
      win.last_move = where;
    }
  },

  /**
   * pass width or height = -1 to maximize in this direction
   */
  _moveFocused: function(where) {
    let win = global.display.focus_window;
    if (win==null) {
        return;
    }
    var pos = win.get_outer_rect();
    
    let sIndex = this._primary;
    let sl = this._screens.length;
    
    // left edge is sometimes -1px... 
    pos.x = pos.x < 0 ? 0 : pos.x;
    for (let i=0; i<sl; i++) {
      if (i == sl-1) {
        sIndex = i;
        break;
      }
      if (this._screens[i].x <= pos.x && this._screens[(i+1)].x > pos.x) {
        sIndex = i;
        break;
      }
    }
    
    let s = this._screens[sIndex];
    
    let diff = null,
      sameWidth = this._samePoint(pos.width, s.width),
      sameHeight = this._samePoint(s.height, pos.height);
    
    // the main panel is hidden
    if (Main.panel.hidden) {
      s.y = 0;
      s.height = s.totalHeight/2 - 4;
      s.sy = (s.totalHeight)/2 -4;
    } else {
      s.height = s.totalHeight/2 - this._topBarHeight
      s.sy = (s.totalHeight + this._topBarHeight)/2;
    }

    // sIndex is the target index if we move to another screen.-> primary!=sIndex
    let winHeight = pos.height + this._topBarHeight;
    let maxH = (pos.height >= s.totalHeight) || this._samePoint(winHeight, s.totalHeight);
 
    if (where=="n") {
      this._resize(win, s.x, s.y, -1, s.height);
      win.last_move = "n";
    } else if (where == "e") {
      this._thirdsE(win, "e", s.x+s.width, s.y, s.width,
                    (s.totalWidth/3)*2, s.totalWidth/3, -1);
    } else if (where == "s") {
      this._resize(win, s.x, s.sy, -1, s.height);
      win.last_move = "s";
    } else if (where == "w") {
      this._thirdsW(win, "w", s.x, s.y, s.width,
                    (s.totalWidth/3)*2, s.totalWidth/3, -1);
    }
    
    if (where == "ne") {
      this._thirdsE(win, "ne", s.x+s.width, s.y, s.width,
                    (s.totalWidth/3)*2, s.totalWidth/3, s.height);
    } else if (where == "se") {
      this._thirdsE(win, "se", s.x+s.width, s.sy, s.width,
                    (s.totalWidth/3)*2, s.totalWidth/3, s.height);
    } else if (where == "sw") {
      this._thirdsW(win, "sw", s.x, s.sy, s.width,
                    (s.totalWidth/3)*2, s.totalWidth/3, s.height);
    } else if (where == "nw") {
      this._thirdsW(win, "sw", s.x, s.y, s.width,
                    (s.totalWidth/3)*2, s.totalWidth/3, s.height);
    }
    
    // calculate the center position and check if the window is already there
    if (where == "c") {
      let x = s.x + (s.width/2);
      let y = s.y + (s.height/2);
      
      // do not check window.width. until i find get_size_hint(), or min_width..
      // windows that have a min_width < our width it will not work (evolution for example)
      if (this._samePoint(x, pos.x) && this._samePoint(y, pos.y) && sameHeight) {
        // the window is alread centered -> maximize
        this._resize(win, s.x, s.y, -1, -1);
      } else {
        // the window is somewhere else -> resize
        this._resize(win, x, y, s.width, s.height)
      }
    }
  },
  
  // moving the window and the actual position are not really the same
  // if the points are < 30 points away asume as equal
  _samePoint: function(p1, p2) {
    return (Math.abs(p1-p2) <= 20);
  },
  
  // actual resizing
  _resize: function(win, x, y, width, height) {
    
    if (height == -1) {
      win.maximize(Meta.MaximizeFlags.VERTICAL);
      height = 400; // dont resize to width, -1
    } else {
      win.unmaximize(Meta.MaximizeFlags.VERTICAL);
    }

    if (width == -1) {
      win.maximize(Meta.MaximizeFlags.HORIZONTAL);
      width = 400;  // dont resize to height, -1
    } else {
      win.unmaximize(Meta.MaximizeFlags.HORIZONTAL);
    }
    
    // first move the window
    let padding = this._getPadding(win);
    // snap, x, y
    win.move_frame(true, x - padding.x, y - padding.y);
    // snap, width, height, force
    win.resize(true, width - padding.width, height - padding.height);
    
  },

  // the difference between input and outer rect as object.
  // * width /4 looks better
  _getPadding: function(win) {
    let outer = win.get_outer_rect(),
      inner = win.get_input_rect();
    return {
      x: outer.x - inner.x,
      y: (outer.y - inner.y),
      width: 2, //(inner.width - outer.width),
      height: (inner.height - outer.height)
    };
  },
  
  /**
   * Get global.screen_width and global.screen_height and
   * bind the keys
   **/
  _init: function() {
    this._primary = global.screen.get_primary_monitor();
    let numMonitors = global.screen.get_n_monitors();

    // only tested with 2 screen setup
    for (let i=0; i<numMonitors; i++) {
      let geom = global.screen.get_monitor_geometry(i),
        offset = geom.x,
        totalHeight = geom.height;
      
      this._screens[i] =  {
        x : offset,
        y: (i==this._primary) ? this._topBarHeight : 0,
        totalWidth: geom.width,
        totalHeight: totalHeight,
        width: geom.width / 2,
        height: totalHeight/2 - this._topBarHeight
      };
      
      // the position.y for s, sw and se
      this._screens[i].sy = (totalHeight + this._topBarHeight)/2;
    }
    
    // sort by x position. makes it easier to find the correct screen 
    this._screens.sort(function(s1, s2) {
        return s1.x - s2.x;
    });

    // move to n, e, s an w
    this._addKeyBinding("move_to_side_n",
      Lang.bind(this, function(){ this._moveFocused("n");})
    );
    this._addKeyBinding("move_to_side_e",
      Lang.bind(this, function(){ this._moveFocused("e");})
    );
    this._addKeyBinding("move_to_side_s",
      Lang.bind(this, function(){ this._moveFocused("s");})
    );
    this._addKeyBinding("move_to_side_w",
      Lang.bind(this, function(){ this._moveFocused("w");})
    );

    // move to  nw, se, sw, nw
    this._addKeyBinding("move_to_corner_ne",
      Lang.bind(this, function(){ this._moveFocused("ne");})
    );
    this._addKeyBinding("move_to_corner_se",
      Lang.bind(this, function(){ this._moveFocused("se");})
    );
    this._addKeyBinding("move_to_corner_sw",
      Lang.bind(this, function(){ this._moveFocused("sw");})
    );
    this._addKeyBinding("move_to_corner_nw",
      Lang.bind(this, function(){ this._moveFocused("nw");})
    );

    // move to center. fix 2 screen setup and resize to 50% 50%
    this._addKeyBinding("move_to_center",
      Lang.bind(this, function(){ this._moveFocused("c");})
    );
  },

  /**
   * disconnect all keyboard bindings that were added with _addKeyBinding
   **/
  destroy: function() {
    let size = this._bindings.length;
    for(let i = 0; i<size; i++) {
        this._shellwm.disconnect(this._keyBindingHandlers[this._bindings[i]]);
    }
  }
}

function init(meta) {
  let userExtensionLocalePath = meta.path + '/locale';
  Gettext.bindtextdomain("putWindow", userExtensionLocalePath);
  Gettext.textdomain("putWindow");
};

function enable() {
  this._moveWindow = new MoveWindow();
};

function disable(){
  this._moveWindow.destroy();
};
