
var settings;
var itemList;
var shifted = false;
var parameters;
var socketMode = false;
var httpPostIndex;
var httpPostMode = false;
var appUrl = ("http://localhost:38934/");

function getSettings() {
    return settings;
}

function getItemList() {
    return itemList;
}

function getEditor() {
    return getSettings().editor;
}

function getPropertiesPanel() {
    return getSettings().propertiesPanel;
}




function Editor(editorPanel) {
    this.currentProject = new Project();
    this.editorPanel = editorPanel;
    this.visualFrames = [];
    this.dirty = false;
    var _scale = 1;

    Object.defineProperty(this, "padding", {
        get: function () {
            return this.currentProject.padding;
        },
        set: function (value) {
            this.currentProject.padding = value;
            this.pack();
        }
    });

    Object.defineProperty(this, "scale", {
        get: function () {
            return _scale;
        },
        set: function (value) {
            _scale = value;
            this.editorPanel[0].style.transform = 'scale(' + _scale + ')';
            var size = this.currentProject.size;
            var off = (size.x * _scale * 0.5 - size.x * 0.5) + 'px';
            var offy = (size.y * _scale * 0.5 - size.y * 0.5) + 'px';
            this.editorPanel[0].style.top = offy;
            this.editorPanel[0].style.left = off;
            if (_scale < 1) {
                this.editorPanel[0].parentElement.scrollTop = 0;
            }
        }
    });

    var e = this;
    this.editorPanel.selectable({

        selected: function (event, ui) {
            var vsf = e.visualFrames;
            var vf = vsf[ui.selected.frameIndex];
            var copies = vf.copies;
            for (var i = 0; i < copies.length; i++) {
                copies[i].option.selected = true;
            }
            vf.option.selected = true;
            getItemList().updatePropertiesPanel();
        },
        unselected: function (event, ui) {
            var vsf = e.visualFrames;
            var vf = vsf[ui.unselected.frameIndex];
            var copies = vf.copies;
            for (var i = 0; i < copies.length; i++) {
                copies[i].option.selected = false;
            }
            vf.option.selected = false;
            getItemList().updatePropertiesPanel();
        }
    });


    this.prepareEditorPanel();
}

Editor.prototype.prepareEditorPanel = function () {

    this.editorPanel.width(this.currentProject.size.x);
    this.editorPanel.
        height(this.currentProject.size.y);
}

Editor.prototype.setSize = function (x, y) {
    this.currentProject.size = { x: x, y: y };
    this.scale = this.scale;
    this.prepareEditorPanel();
    this.pack();
}

Editor.prototype.addFrame = function (visualFrameInfo) {

    this.visualFrames.push(visualFrameInfo);
    this.editorPanel.append(visualFrameInfo.canvas);
    visualFrameInfo.removed = false;

}

Editor.prototype.removeFrameByIndex = function (index) {
    var removed = this.visualFrames.splice(index, 1)[0];
    removed.canvas.parentElement.removeChild(removed.canvas);
    removed.removed = true;
    
}

Editor.prototype.pack = function () {
    var min = this.visualFrames.length;
    var selectedMethod = 0;
    var isLastMethodSelected = false;
    for (var i = 0; i < 3; i++) {
        isLastMethodSelected = false;
        var r = this.packWithMethod(i);
        if (r == 0) {
            return;
        }
        if (r <= min) {
            isLastMethodSelected = true;
            min = r;
            selectedMethod = i;
        }
    }

    if (!isLastMethodSelected) {
        this.packWithMethod(selectedMethod);
    }
}

Editor.prototype.packWithMethod = function (methodId) {
    var vfs = [];
    for (var i = 0; i < this.visualFrames.length; i++) {
        vfs.push(this.visualFrames[i]);
        this.visualFrames[i].canvas.frameIndex = i;
    }

    var outSideCount = 0;
    switch (methodId) {
        case 0:
            vfs.sort(function (a, b) {
                return -a.area + b.area;
            });
            break;
        case 1:
            vfs.sort(function (a, b) {
                return -a.size.w * a.reelScale + b.size.w * b.reelScale;
            });
            break;
        case 2:
            vfs.sort(function (a, b) {
                return -a.size.h * a.reelScale + b.size.h * b.reelScale;
            });
            break;
    }
    
    var rects = [];
    var p = this.currentProject;

    var extraX = p.size.x + 3;
    rects.push({ x: 0, y: 0, w: p.size.x, h: p.size.y });

    top: for (var i = 0; i < vfs.length; i++) {
        var vf = vfs[i];
        vf.original = null;
        vf.copies.length = 0;
        var vfSize = vf.size;

        equality: for (var j = i - 1; j >= 0; j--) {
            var vfold = vfs[j];
            var sizeOld = vfold.size;
            if (sizeOld.w * sizeOld.h > vfSize.w * vfSize.h) {
                break equality;
            }
            if (vfold.scale == vf.scale && isCanvassesIdentical(vfold.canvas, vf.canvas)) {
                vf.original = vfold;
                vfold.copies.push(vf);
                vf.position = vfold.position;
                continue top;
            }
        }
        var globalScale = getSettings().scale;
        vfSize.w *= vf.reelScale;
        vfSize.h *= vf.reelScale;
        vfSize.w += this.padding;
        vfSize.h += this.padding;
        for (var j = rects.length - 1; j >= 0; j--) {
            var rect = rects[j];
            if (rect.w >= vfSize.w && rect.h >= vfSize.h) {
                vf.position = { x: rect.x, y: rect.y };

                var dw = rect.w - vfSize.w;
                var dh = rect.h - vfSize.h;
                if (dw > dh) {
                    rects.push({ x: rect.x, y: rect.y + vfSize.h, w: vfSize.w, h: dh });
                    rect.x += vfSize.w;
                    rect.w -= vfSize.w;
                }
                else {
                    rects.push({ x: rect.x + vfSize.w, y: rect.y, w: dw, h: vfSize.h });
                    rect.y += vfSize.h;
                    rect.h -= vfSize.h;
                }

                continue top;
            }
        }
        vf.position = { x: extraX, y: 0 };
        extraX += vfSize.w + 3;
        outSideCount++;
    }
    return outSideCount;
}

Editor.prototype.exportSheet = function (onresult) {
    var settings = getSettings();

    // canvas to export
    var c = document.createElement('canvas');
    var size = this.currentProject.size;
    c.width = size.x;
    c.height = size.y;

    // project object to export
    var project = {};
    var texture = project.texture = {}; // global properties are stored here
    var frames = project.frames = []; // frame properties are stored here

    // init global properties
    texture.width = this.currentProject.size.x;
    texture.height = this.currentProject.size.y;
    texture.scale = settings.scale;
    texture.padding = this.padding;

    var ctx = c.getContext('2d');
    var vfs = this.visualFrames;
    var globalScale = getSettings().scale;
    var unscaledCount = 0;
    for (var i = 0; i < vfs.length; i++) {
        // paint frame into canvas
        var vf = vfs[i];
        var scl = vf.reelScale;
        var pos = vf.position;
        pos.x = Math.round(pos.x);
        pos.y = Math.round(pos.y);
        var w, f;
        if (scl > 0.999 && scl < 1.001) {
            unscaledCount++;
            ctx.drawImage(vf.canvas, pos.x, pos.y);
            w = vf.canvas.width;
            h = vf.canvas.height;
        }
        else {
            var size = vf.size;
            w = size.w * scl;
            h = size.h * scl;
            ctx.drawImage(vf.canvas, pos.x, pos.y, w, h);
        }

        // write frame properties to project
        var frame = {
            name: vf.name,
            x: pos.x,
            y: pos.y,
            width: Math.round(w),
            height: Math.round(h),
            scale: vf.scale,
            offsetX: Math.round(scl * vf.offset.x * 2) * 0.5,
            offsetY: Math.round(scl * vf.offset.y * 2) * 0.5,
            originalWidth: Math.round(scl * vf.originalSize.w),
            originalHeight: Math.round(scl * vf.originalSize.h),
            margin :vf.margin,
        };

        frames.push(frame);
    }
    console.log("unscale ratio: " + unscaledCount + " / " + vfs.length);
    onresult(c, JSON.stringify(project));
}




function Settings(editor, propertiesPanel, widthInput, heightInput, paddingInput, itemScaleInput, scaleInput, importOptionsSelect, saveDialog) {
    this.editor = editor;
    this.propertiesPanel = propertiesPanel;
    this.scale = 1;
    this.importOptionsSelect = importOptionsSelect;
    this.saveDialog = saveDialog;

    var set = this;
    function refreshSize() {
        editor.setSize(
            parseInt(widthInput.val()),
            parseInt(heightInput.val()));
    }
    function refreshPadding() {
        editor.padding = parseInt(paddingInput.val());
    }
    function refreshScale() {
        editor.scale = parseFloat(scaleInput.val());
    }
    function refreshItemScale() {
        set.scale = parseFloat(itemScaleInput.val());
        getItemList().setDirty();
    }

    refreshSize();
    refreshPadding();
    refreshItemScale();

    widthInput.change(function () {
        clampValue(this);
        refreshSize();
    });
    heightInput.change(function () {
        clampValue(this);
        refreshSize();
    });
    paddingInput.change(function () {
        clampValue(this);
        refreshPadding();
    });
    scaleInput.on('input', function () {
        refreshScale();
    });
    scaleInput.change(function () {
        clampValue(this);
        refreshScale();
    });
    itemScaleInput.change(function () {
        clampValue(this);
        refreshItemScale();
    });

    this.setSize = function (w, h) {
        widthInput.val(w);
        heightInput.val(h);
        refreshSize();
    }
    this.setScale = function (scale) {
        itemScaleInput.val(scale);
        refreshItemScale();
    }
    this.setPadding = function (padding) {
        paddingInput.val(padding);
        refreshPadding();
    }
}

Settings.prototype.getImportSetting = function () {
    return this.importOptionsSelect.val();
}



function ItemList(editor, itemList) {
    this.editor = editor;
    this.itemList = itemList;

    var eventQueue = [];
    var busy = false;
    var consumeEvent = function () {
        busy = true;
        var e = eventQueue.shift();
        e.event(e.param);
    };
    this.doEvent = function (event, param) {
        eventQueue.push({ event: event, param: param });
        if (!busy) {
            consumeEvent();
        }
    };
    this.eventFinished = function () {
        busy = false;
        if (eventQueue.length > 0) {
            consumeEvent();
        }
        else {
            this.editor.pack();
        }
    };
    var e = this;
    this.itemList.on('input', function () {
        e.refreshSelectedVisuals();
    });
}

ItemList.prototype.addFrame = function (url, name) {
    var e = this;
    this.doEvent(function () {
        new VisualFrameInfo(name, url, function (result) {
            if (result) {
                
                e.addFrameDirect(result);

            }
            e.eventFinished();
            
        });
    });
}

ItemList.prototype.addFrameDirect = function (visualFrame) {
    var e = this;
    var vfs = e.editor.visualFrames;
    for (var i = 0; i < vfs.length; i++) {
        if (visualFrame.name === vfs[i].name) {
            switch (getSettings().getImportSetting()) {
                case 'keep_size':
                    var osize = vfs[i].reelScale * vfs[i].size.w;
                    visualFrame.scale = osize / (getSettings().scale * visualFrame.size.w);
                    break;
                case 'keep_scale':
                    visualFrame.scale = vfs[i].scale;
                    break;
            }
            e.removeFrameByIndex(i);
            break;
        }
    }

    e.editor.addFrame(visualFrame);
    var op = document.createElement('option');
    op.text = visualFrame.name;
    op.value = visualFrame.name;
    visualFrame.option = op;
    e.itemList.append(op);


}

ItemList.prototype.removeFrameByIndex = function (index) {
    this.editor.removeFrameByIndex(index);
    var op = this.itemList.get(0).options[index];
    this.itemList.get(0).removeChild(op);
}

ItemList.prototype.refreshSelectedVisuals = function () {
    var ops = this.itemList.get(0).options;
    var vfs = this.editor.visualFrames;
    for (var i = 0; i < ops.length; i++) {
        var op = ops[i];
        var vf = vfs[i];
        if (op.selected) {
            $(vf.canvas).addClass('ui-selected');
        }
        else {
            $(vf.canvas).removeClass('ui-selected');
        }
    }
    this.updatePropertiesPanel();
}


ItemList.prototype.removeSelecteds = function () {
    var il = this;
    var opsor = this.itemList.get(0).options;
    var ops = [];
    
    for (var i = 0; i < opsor.length; i++) {
        ops.push(opsor[i]);
    }

    for (var i = 0; i < ops.length; i++) {
        var op = ops[i];
        if (op.selected) {
            this.doEvent(function (option) {
                if (option.parentElement && option.selected) {
                    il.removeFrameByIndex(option.index);
                }
                il.eventFinished();
            }, op);

        }
    }

    getPropertiesPanel().visibility = false;
}

ItemList.prototype.setDirty = function () {
    var il = this;
    this.doEvent(function () { il.eventFinished() });
}

ItemList.prototype.loadProject = function (image, projectJson) {


    var project = JSON.parse(projectJson);
    var textureProps = project.texture;
    var set = getSettings();
    set.setSize(textureProps.width, textureProps.height);
    set.setScale(textureProps.scale);
    set.setPadding(textureProps.padding);

    var frames = project.frames;
    for (var i = 0; i < frames.length; i++) {
        var frame = frames[i];
        var v = new VisualFrameInfo(frame.name);

        
        v.canvas = document.createElement('canvas');
        v.canvas.className = "visualFrame";
        v.canvas.frameIndex = i;

        v.position = { x: frame.x, y: frame.y };
        v.canvasInternalScale = textureProps.scale * frame.scale;
        v.scale = frame.scale;
        v.offset = { x: frame.offsetX, y: frame.offsetY };
        v.originalSize = { w: frame.originalWidth, h: frame.originalHeight };

        v.canvas.width = frame.width;
        v.canvas.height = frame.height;

        v.margin = frame.margin == undefined ? 0 : frame.margin;

        var ctx = v.canvas.getContext('2d');

        ctx.drawImage(image, -frame.x, -frame.y);

        this.addFrameDirect(v);
    }
    //this.setDirty();
}





ItemList.prototype.updatePropertiesPanel = function () {

    var sop = this.itemList.get(0).selectedOptions;
    if (sop.length > 0) {
        getPropertiesPanel().editObject(this);
    }
    else {
        getPropertiesPanel().visibility = false;
    }
}
ItemList.prototype.getSelectedValue = function (fieldName) {
    var sop = this.itemList.get(0).selectedOptions;
    var r = null;
    for(var i = 0; i < sop.length; i++) {
        var frame = this.editor.visualFrames[sop[i].index];
        var val = frame[fieldName];
        if(r === null) {
            r = val;
        }
        else {
            if(r !== val) {
                r = "-";
                break;
            }
        }
    }
    return r;
}
ItemList.prototype.setSelectedValue = function (fieldName, value, onlyOne) {
    var sop = this.itemList.get(0).selectedOptions;
    if(onlyOne && sop.length != 1) {
        return;
    }
    for(var i = 0; i < sop.length; i++) {
        var frame = this.editor.visualFrames[sop[i].index];
        frame[fieldName] = value;
    }
}
ItemList.prototype.get = function(index) {
    var sop = this.itemList.get(0).selectedOptions;
    return this.editor.visualFrames[sop[index].index];
}


function PropertyPanel(propertyPanelTable, inputClassName) {
    this.table = propertyPanelTable[0];
    //this.body = this.table.children('tbody');
    this.inputClassName = inputClassName;
    
    Object.defineProperty(this.table, "visibility", {
        set: function(value) {
            console.log("setting for: " + this.style);
            this.style.visibility = value ? "visible" : "hidden";
            console.log("set visibility: " + value);
        }
    });

    this.table.visibility = false;
}


PropertyPanel.prototype.editObject = function (itemList) {
    this.table.visibility = true;
   
    var ppName = $('#ppName')[0];
    ppName.value = itemList.getSelectedValue('name');
    ppName.oninput = (function() {
        itemList.setSelectedValue('name', this.value, true);
    });
    var ppScale = $('#ppScale')[0];
    ppScale.value = itemList.getSelectedValue('scale');
    ppScale.placeholder = itemList.get(0).scale;
    ppScale.oninput = (function() {
        itemList.setSelectedValue('scale', parseFloat(this.value), false);
        //obj.scale = parseFloat(this.value);
        getItemList().setDirty();
    });
    $('#ppReelScale')[0].innerHTML = itemList.getSelectedValue('reelScale');
    var ppMargin = $('#ppMargin')[0];
    ppMargin.value = itemList.getSelectedValue('margin');
    ppMargin.oninput = (function() {
        itemList.setSelectedValue('margin', parseFloat(this.value), false);
        //obj.margin = parseFloat(this.value);
        getItemList().setDirty();
    });
    $('#ppExport')[0].onclick = (function() {
        itemList.get(0).export();
    });
    // for (var i = 0; i < fieldNameArray.length; i++) {
    //     var fn = fieldNameArray[i];
    //     var val = obj[fn];
    //     var displayName = fn;
    //     if(val.displayName !== undefined) {
    //         displayName = val.displayName;
    //     }
    //     //console.log(typeof val);
    //     switch (typeof val) {
    //         case 'number':
    //             var input = this.addInput(displayName, obj, fn);
    //             input.type = 'number';
    //             input.step = 0.1;
    //             input.value = val;
    //             input.oninput = (function () {
    //                 this.obj[this.fn] = parseFloat(this.value);
    //                 this.value = this.obj[this.fn];
    //                 getItemList().setDirty();
    //             });
    //             break;
    //         case 'string':
    //             var input = this.addInput(displayName, obj, fn);
    //             input.type = 'text';
    //             input.value = val;
    //             input.onchange = (function () {
    //                 this.obj[this.fn] = (this.value);
    //                 this.value = this.obj[this.fn];
    //             });
    //             break;
    //         case 'function':
    //             var input = this.addInput(displayName, obj, fn);
    //             input.type = 'button';
    //             input.value = fn;
    //             input.onclick = (function () {
    //                 this.obj[this.fn]();
    //             });
    //             break;
    //         default:
    //             var input = this.addInput(displayName, obj, fn, true);
    //             input.innerHTML = val.value;
    //             break;
    //     }
    // }
}



function Project() {
    this.frames = [];
    this.filePath = null;
    this.size = { x: 1024, y: 1024 };
    this.padding = 1;
}

function FrameInfo(image) {
}





function VisualFrameInfo(name, url, result) {
    
    this._init();
    this.name = name;
    if (url !== undefined) {
        this.tryTiff = function () {
            var ext = name.substr(name.lastIndexOf('.') + 1).toUpperCase();
            if ((ext == "TIF" || ext == "TIFF")) {

                var xhr = new XMLHttpRequest();
                xhr.v = this;
                xhr.open('GET', url, true);
                xhr.responseType = 'arraybuffer';

                xhr.onreadystatechange = function () {
                    if (this.readyState != 4) { return; }
                    if (this.status == 200) {

                        var noEr = false;
                        var tiffParser = new TIFFParser();
                        try {

                            this.v.canvas = document.createElement('canvas');
                            this.v.canvas.className = "visualFrame";
                            this.v.canvas = tiffParser.parseTIFF(this.response, this.v.canvas);

                            noEr = true;
                        }
                        catch (err) {
                            result(null);
                        }
                        tiffParser = null;
                        if (noEr) {
                            this.v.prepareCanvas();
                            if (this.v.canvas.width != 0) {
                                result(this.v);
                            }
                            else {
                                result(null);
                            }
                        }

                    }
                    else {
                        result(null);
                    }
                    this.v = null;
                };

                xhr.send();
                xhr = null;

            }
            else {
                result(null);
            }
        };

        var image = new Image();
        image.v = this;
        image.onload = function () {
            this.v.canvas = document.createElement('canvas');
            this.v.canvas.className = "visualFrame";
            this.v.prepareCanvasWithImage(this);
            if (this.v.canvas.width != 0) {
                result(this.v);
            } else {
                result(null);
            }
            this.v.tryTiff = null;
            this.v = null;
        }

        image.onerror = function () {

            this.v.tryTiff();
            this.v.tryTiff = null;
            this.v = null;

        };

        image.src = url;
        image = null;
    }
}

VisualFrameInfo.prototype._init = function () {
    this.copies = [];
    this._original = null;
    this.canvasInternalScale = NaN;
    var position = { x: 0, y: 0 };
    var scale = 1;
    var margin = 0;

    this._refreshTransform = function () {
        
        this.canvas.style.transform =
            'translate(' + position.x + 'px, ' + position.y + 'px)' + ' ' +
            'scale(' + this.reelScale + ')';
    };
    Object.defineProperty(this, "position", {
        get: function () {
            return position;
        },
        set: function (value) {
            position = value;
            for (var i = 0; i < this.copies.length; i++) {
                this.copies[i].position = value;
            }
            this._refreshTransform();
        }
    });
    Object.defineProperty(this, "reelScale", {
        get: function(){
            var scl = (scale * getSettings().scale);
            if (!isNaN(this.canvasInternalScale)) {
                scl /= this.canvasInternalScale;
            }
            return scl;
        },
        set: function () {
            
        },
    });
    Object.defineProperty(this, "scale", {
        get: function () {
            return scale;
        },
        set: function (value) {
            scale = value;
            this._refreshTransform();
        }
    });
    Object.defineProperty(this, "margin", {
        get: function () {
            return margin;
        }, set: function (value) {
            margin = value;
        }
    });
    Object.defineProperty(this, "size", {
        get: function () {
            return { w: this.canvas.width, h: this.canvas.height };
        }
    });
    Object.defineProperty(this, "area", {
        get: function () {
            var size = this.size;
            var scale = this.reelScale;
            return size.w * size.h * scale * scale;
        }
    });
    Object.defineProperty(this, "original", {
        get: function () {
            return this._original;
        },
        set: function (value) {
            this._original = value;
            if (this._original) {
                this.canvas.style.visibility = 'collapse';
                this.option.text = '*' + this.name;
            }
            else {
                this.canvas.style.visibility = 'visible';
                this.option.text = this.name;
            }
        }
    });
    Object.defineProperty(this, "backgroundColor", {
        get: function () {
            return this.canvas.style.backgroundColor;
        },
        set: function (value) {
            this.canvas.style.backgroundColor = value;
        }
    });
}

VisualFrameInfo.prototype.prepareCanvasWithImage = function (image) {
    var canvas = this.canvas;
    canvas.width = image.width;
    canvas.height = image.height;
    var context = this.canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);

    this.prepareCanvas();
}

VisualFrameInfo.prototype.prepareCanvas = function () {

    var w = this.canvas.width;
    var h = this.canvas.height;
    var rect = this.canvas.trim();

    this.originalSize = { w: w, h: h };
    this.offset = {
        x:
            (rect.x - (w - rect.w) * 0.5),
        y: -(rect.y - (h - rect.h) * 0.5),
    };
}
VisualFrameInfo.prototype.export = function () {
    //console.log('exporting single frame');
    //console.log(this);

    getSettings().saveDialog.open(this.canvas.toDataURL(), null, this.name);
}



function SaveDialog(parent, saveSheetLink, saveCoordinatesLink) {
    this.parent = parent;
    this.saveSheetLink = saveSheetLink;
    this.saveCoordinatesLink = saveCoordinatesLink;

    Object.defineProperty(this, "visible", {
        set: function (value) {
            this.parent.css("display", value ? "block" : "none");
        }
    });

}

SaveDialog.prototype.open = function (imageUrl, data_json, imageName) {
    this.visible = true;
    this.saveSheetLink.attr('download', imageName);
    this.saveSheetLink.attr('href', imageUrl);
    if (data_json) {
        this.saveCoordinatesLink.css('visibility', 'visible');
        var file = new Blob([data_json], { type: 'text/plain' });
        this.saveCoordinatesLink.attr('href', URL.createObjectURL(file));
    }
    else {
        this.saveCoordinatesLink.css('visibility', 'hidden');

    }

}



HTMLCanvasElement.prototype.isRowEmpty = function (pixels, rowIndex, columnCount, startCol, endCol) {
    var stride = columnCount * 4;
    var s = stride * rowIndex;
    var start = s + startCol * 4;
    var end = s + endCol * 4;

    for (var i = start + 3; i < end; i += 4) {
        if (pixels[i] != 0) {
            return false;
        }
    }
    return true;
}

HTMLCanvasElement.prototype.isColumnEmpty = function (pixels, columnIndex, columnCount, startRow, endRow) {
    var stride = columnCount * 4;
    var start = startRow * stride + columnIndex * 4;
    var end = endRow * stride + columnIndex * 4;

    for (var i = start + 3; i < end; i += stride) {
        if (pixels[i] != 0) {
            return false;
        }
    }
    return true;
}

HTMLCanvasElement.prototype.trim = function () {
    var canvas = this;
    var ctx = canvas.getContext("2d");
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var pixels = imageData.data;
    var w = imageData.width;
    var h = imageData.height;
    var numPixels = w * h;

    var x = 0;
    var y = 0;
    var width = 0;
    var height = 0;
    while (canvas.isColumnEmpty(pixels, x, w, 0, h)) {
        x++;
        if (x >= w) {
            canvas.width = width;
            canvas.height = height;
            return {
                x: 0,
                y: 0,
                w: 0,
                h: 0,
            };
        }
    }
    width = w - x;
    while (canvas.isColumnEmpty(pixels, x + width - 1, w, 0, h)) {
        width--;
    }
    while (canvas.isRowEmpty(pixels, y, w, x, x + width)) {
        y++;
    }
    height = h - y;
    while (canvas.isRowEmpty(pixels, y + height - 1, w, x, x + width)) {
        height--;
    }

    pixels = ctx.getImageData(x, y, width, height);
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(pixels, 0, 0);

    return {
        x: x,
        y: y,
        w: width,
        h: height,
    };
}





function isCanvassesIdentical(c1, c2) {
    if (c1.width != c2.width || c1.height != c2.height) {
        return false;
    }
    var d1 = c1.getContext('2d').getImageData(0, 0, c1.width, c1.height).data;
    var d2 = c2.getContext('2d').getImageData(0, 0, c1.width, c1.height).data;
    for (var i = 0; i < d1.length; i++) {
        if (d1[i] != d2[i]) {
            return false;
        }
    }
    return true;
}

function allowFileDrop(ev) {

    ev.preventDefault();
}

function fileDropHandle(ev) {
    ev.preventDefault();
    var items = ev.dataTransfer.items;
    var files = ev.dataTransfer.files;
    if (files != null) {
        console.log("files length: " + files.length);
        for (var i = 0, file; file = files[i]; i++) {
            var reader = new FileReader();
            reader.tempName = file.name;
            reader.onload = function (e2) {
                //console.log(typeof e2.target.result);
                getItemList().addFrame(e2.target.result, this.tempName);
            }
            reader.readAsDataURL(file);

        }
    }
    if (items) {
        console.log("items length: " + items.length);
        var entryList = [];
        for (var i = 0; i < items.length; i++) {
            var entry = items[i].webkitGetAsEntry();
            if (entry.isDirectory) {
                entryList.push(entry);
            }
        }

        iterateAllFilesInHierarchy(entryList, function (result) {

            result.file(function (file) { //this does the trick
                var obj = URL.createObjectURL(file);
                getItemList().addFrame(obj, result.name);
            });

            //var reader = new FileReader();
            //reader.tempName = result.name;
            //reader.onload = function (e2) {
            //    //console.log(typeof e2.target.result);
            //    getItemList().addFrame(e2.target.result, this.tempName);
            //}
            //reader.readAsDataURL(result.file);

        });
    }
}

function iterateAllFilesInHierarchy(entryArray, result, path) {

    for (var i = 0; i < entryArray.length; i++) {
        var entry = entryArray[i];
        if (entry.isFile) {
            result(entry);
        }
        else if (entry.isDirectory) {
            var reader = entry.createReader();
            reader.readEntries(function (res) {
                iterateAllFilesInHierarchy(res, result, path + entry.name+"/");
            });
        }
    }

}

function initEditorPanel() {

}

function clampValue(inputElement) {
    inputElement.value = Math.max(inputElement.min, Math.min(inputElement.value, inputElement.max))
}

function exportAction() {
    getEditor().exportSheet(function (canvas, data_json) {
        //alert(window.location.href + " " + document.URL);

        //console.log(" is  bleeediiiing");
        //bleedColors(canvas, 5);
        if (httpPostMode) {
            //var request = new XMLHttpRequest();
            //request.open("POST", appUrl);
            //request.send(fd);
            var request = new XMLHttpRequest();
            request.open("POST", appUrl);
            var obj = {
                image: canvas.toDataURL(),
                data: data_json,
                index: httpPostIndex,
            };

            request.send(JSON.stringify(obj));
        }
        else {
            getSettings().saveDialog.open(canvas.toDataURL(), data_json, "sprite sheet.png");
        }
    });
}

function closePopup() {
    getSettings().saveDialog.visible = false;
}

function initUrlParameters() {
    parameters = {};
    var query = window.location.search.substring(1);
    //console.log(query);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        parameters[pair[0]] = pair[1];
        //console.log(pair[0] + " : " + pair[1]);
    }
}
function initSocket() {
    alert("starting");
    var ws = new WebSocket("ws://localhost:38934");

    ws.onopen = function () {
        // Web Socket is connected, send data using send()
        //
        //ws.send(5);
        ws.send(0);
        //ws.send(544);
        alert("sent message biech");
        ws.send(0);
        alert("sent message biech");
        ws.send(0);
        alert("sent message biech");
        ws.close();
        //ws.send(4);
        //ws.send(1223);
    };
    ws.onmessage = function (evt) {
        var received_msg = evt.data;
        alert("Message is received..." + received_msg);
    };

    ws.onclose = function () {
        // websocket is closed.
        alert("Connection is closed...");
    };

}

function initHttpPostMode() {
    
    httpPostMode = true;
    

    request = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (request.readyState == 4 && request.status == 200 && request.responseText.length>2) {
            var im = new Image();
            im.onload = function () {
                //console.log(im.width, im.height);
                getItemList().loadProject(this, request.responseText);

            };
            im.onerror = function (err) {
                console.log(err);
            };

            im.crossOrigin = "Anonymous";
            im.src = appUrl + 'getTexture/' + "?index=" + httpPostIndex;
            im = null;
        }
    }
    request.onerror = function (err) {
        console.log(err);
    };
    request.open("GET", appUrl + 'getFrameData/' + "?index=" + httpPostIndex);

    request.send();
}

function bleedColors(canvas, maxNumberOfIteration) {
    

    var ctx = canvas.getContext("2d");
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var pixels = imageData.data;
    
    var w = canvas.width;
    var h = canvas.height;
    
    var stride = w * 4;

    var emptyDictionary1 = {};
    var emptyDictionary2 = {};
    var rowStart = 0;
    for (var y = 0; y < imageData.height; y++) {
        var index = rowStart;
        for (var x = 0; x < imageData.width; x++) {
            if (pixels[index + 3] < 5) {
                emptyDictionary1[index] = { "x": x, "y": y };
                if (pixels[index + 3] == 0) {
                    pixels[index + 3] = 8;
                }
            }
             
            //pixels[index + 3] = 128;



            index += 4;
        }
        rowStart += stride;
    }
    /*var k = 10000;
    for (var index in emptyDictionary1) {
        console.log(index + " " + emptyDictionary1[index].x);
        k--;
        if (k < 0) {
            break;
        }
    }*/
    for (var it = 0; it < maxNumberOfIteration; it++) {
        
        for (var index_s in emptyDictionary1) {
            var coord = emptyDictionary1[index_s];
            var index = +index_s;
            var x = coord.x;
            var y = coord.y;
            var opaqueCount = 0;
            var color = [0, 0, 0];
            if (x > 0 && addIfOpaque(color, pixels, index - 4, emptyDictionary1)) {
                
                opaqueCount++;
            }
            if (x < w - 1 && addIfOpaque(color, pixels, index + 4, emptyDictionary1)) {
                
                opaqueCount++;
            }
            if (y > 0 && addIfOpaque(color, pixels, index - stride, emptyDictionary1)) {
                
                opaqueCount++;
            }
            if (y < h - 1 && addIfOpaque(color, pixels, index + stride, emptyDictionary1)) {
                
                opaqueCount++;
            }
            if (opaqueCount > 0) {

                arrayMultiplication(color, 1 / opaqueCount);
                pixels[index] = color[0];
                pixels[index + 1] = color[1];
                pixels[index + 2] = color[2];
                //pixels[index + 3] = 255;
            }
            else {
                
                emptyDictionary2[index] = coord;
            }
        }
        //console.log(Object.keys(emptyDictionary1).length + " " + Object.keys(emptyDictionary2).length);
        emptyDictionary1 = emptyDictionary2;
        emptyDictionary2 = {};
    }
    ctx.putImageData(imageData, 0, 0);
}
function arrayMultiplication(color, multiplier) {
    for (var i = 0; i < color.length; i++) {
        color[i] = Math.round(color[i] * multiplier);
    }
}
function addIfOpaque(color, array, index, emptyDictionary1) {
    
    if (emptyDictionary1[index] != null) {
        
        return false;
    }
    for (var i = 0; i < color.length; i++) {
        color[i] += array[index + i];
    }
    return true;
}

function bleedAction() {

    getEditor().exportSheet(function (canvas, data_json) {
        var newTab = window.open("", "_blank");
        $(newTab.document).ready(function () {
            //bleedColors(canvas, 5);
            newTab.document.body.appendChild(canvas);
        });
    
    });
}



$(function () {

    initUrlParameters();


    editorPanel = $("#editor");

    var editor = new Editor(editorPanel);
    var propertiesPanel = new PropertyPanel($('#properties_panel_table'), 'property_input');
    var saveDialog = new SaveDialog($('#save_dialog'), $('#a_save_sheet'), $('#a_save_coordinates'));

    itemList = new ItemList(editor, $("#items_list"));

    settings = new Settings(
        editor,
        propertiesPanel,
        $("#st_width"),
        $("#st_height"),
        $("#st_padding"),
        $('#st_item_scale'),
        $('.st_scale_val'),
        $('#import_settings'),
        saveDialog
        );


    $(document).on('keyup keydown', function (e) {
        shifted = e.shiftKey;
    });
    $(document).on('keyup keyup', function (e) {
        shifted = e.shiftKey;
        var x = event.which || event.keyCode;
        if (x == 46) {
            getItemList().removeSelecteds();
        }
    });

    socketMode = parameters.hasOwnProperty('socketMode');
    httpPostIndex = (parameters['httpPostIndex']);


    if (socketMode) {
        initSocket();
    }

    if (httpPostIndex != null) {
        initHttpPostMode();
        //console.log("post mode");
    }
    else {
        //console.log("no mode");
    }

});
