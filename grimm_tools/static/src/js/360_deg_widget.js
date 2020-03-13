odoo.define('grimm_ui.image_360', function (require) {
    "use strict";

    var AbstractField = require('web.AbstractField');
    var field_registry = require('web.field_registry');
    var FieldBinaryImage = require('web.basic_fields').FieldBinaryImage;
    var Dialog = require('web.Dialog');
    var core = require('web.core');
    var _t = core._t;
    var qweb = core.qweb;
    var utils = require('web.utils');
    var field_utils = require('web.field_utils');
    var session = require('web.session');

    var AbstractFieldBinary = AbstractField.extend({
        events: _.extend({}, AbstractField.prototype.events, {
            'change .o_input_file': 'on_file_change',
            'click .o_select_file_button': function () {
                this.$('.o_input_file').click();
            },
            'click .o_clear_file_button': 'on_clear',
        }),
        init: function (parent, name, record) {
            this._super.apply(this, arguments);
            this.fields = record.fields;
            this.useFileAPI = !!window.FileReader;
            this.max_upload_size = 25 * 1024 * 1024; // 25Mo
            if (!this.useFileAPI) {
                var self = this;
                this.fileupload_id = _.uniqueId('o_fileupload');
                $(window).on(this.fileupload_id, function () {
                    var args = [].slice.call(arguments).slice(1);
                    self.on_file_uploaded.apply(self, args);
                });
            }
        },
        destroy: function () {
            if (this.fileupload_id) {
                $(window).off(this.fileupload_id);
            }
            this._super.apply(this, arguments);
        },
        on_file_change: function (e) {
            var self = this;
            var file_node = e.target;
            if ((this.useFileAPI && file_node.files.length) || (!this.useFileAPI && $(file_node).val() !== '')) {
                if (this.useFileAPI) {
                    var file = file_node.files[0];
                    if (file.size > this.max_upload_size) {
                        var msg = _t("The selected file exceed the maximum file size of %s.");
                        this.do_warn(_t("File upload"), _.str.sprintf(msg, utils.human_size(this.max_upload_size)));
                        return false;
                    }
                    var filereader = new FileReader();
                    filereader.readAsDataURL(file);
                    filereader.onloadend = function (upload) {
                        var data = upload.target.result;
                        data = data.split(',')[1];
                        self.on_file_uploaded(file.size, file.name, file.type, data);
                    };
                } else {
                    this.$('form.o_form_binary_form input[name=session_id]').val(this.getSession().session_id);
                    this.$('form.o_form_binary_form').submit();
                }
                this.$('.o_form_binary_progress').show();
                this.$('button').hide();
            }
        },
        on_file_uploaded: function (size, name) {
            if (size === false) {
                this.do_warn(_t("File Upload"), _t("There was a problem while uploading your file"));
                // TODO: use crashmanager
                console.warn("Error while uploading file : ", name);
            } else {
                this.on_file_uploaded_and_valid.apply(this, arguments);
            }
            this.$('.o_form_binary_progress').hide();
            this.$('button').show();
        },
        on_file_uploaded_and_valid: function (size, name, content_type, file_base64) {
            this.set_filename(name);
            this._setValue(file_base64);
            this._render();
        },
        /**
         * We need to update another field.  This method is so deprecated it is not
         * even funny.  We need to replace this with the mechanism of field widgets
         * declaring statically that they need to listen to every changes in other
         * fields
         *
         * @deprecated
         *
         * @param {any} value
         */
        set_filename: function (value) {
            var filename = this.attrs.filename;
            if (filename && filename in this.fields) {
                var changes = {};
                changes[filename] = value;
                this.trigger_up('field_changed', {
                    dataPointID: this.dataPointID,
                    changes: changes,
                    viewType: this.viewType,
                });
            }
        },
        on_clear: function () {
            this.set_filename('');
            this._setValue(false);
            this._render();
        },
    });

    var FieldPreviewBinary360 = FieldBinaryImage.include({
        events: _.extend({}, AbstractFieldBinary.prototype.events, {
            'click img': function () {
                if (this.mode === "readonly") {
                    this.trigger_up('bounce_edit');
                }
                if (this.model == "product.template" && this.field.name == "image_medium") {
                    this.on_image_clicked();
                }
            },
        }),
        _render: function () {
            var self = this;
            var url = this.placeholder;
            if (this.value) {
                if (!utils.is_bin_size(this.value)) {
                    url = 'data:image/png;base64,' + this.value;
                } else {
                    url = session.url('/web/image', {
                        model: this.model,
                        id: JSON.stringify(this.res_id),
                        field: this.nodeOptions.preview_image || this.name,
                        // unique forces a reload of the image when the record has been updated
                        unique: field_utils.format.datetime(this.recordData.__last_update).replace(/[^0-9]/g, ''),
                    });
                }
            }
            var img = "0";
            var img_360 = "0";
//            console.log('Product Model ? yes : no = ' + this.model);
            if (this.model == "product.template" || this.model == "product.product") {
                $.ajax({
                    url : 'https://imageserver.partenics.de/odoo/' + self.recordData.barcode + '?format=json',
                    type: 'get',
                    data : {},
                    contentType: false,
                    cache: false,
                    processData:false
                    }).done(function (data) {
                        console.log(data);
                        var res = JSON.parse(data);
                        var image_arr = res["images"];
                        if (res["count"] > 0) {
                            for (var i=0; i<res["count"]; i++) {
                              console.log(image_arr[i]["type"]);
                              if(img == "0" && image_arr[i]["type"] == "image") {
                                img = "1";
                              }
                              if(img_360 == "0" && image_arr[i]["type"] == "360") {
                                img_360 = "1";
                              }
                            }
                        }
                        console.log('Image: ' + img.toString() + ' , 360: ' + img_360);
                        var $img = $(qweb.render("FieldBinaryImage-img", {widget: self, url: url, 'image': img, 'img_360': img_360}));
                        self.$('> img').remove();
                        self.$el.prepend($img);
                        $img.on('error', function () {
                            self.on_clear();
                            $img.attr('src', self.placeholder);
                            self.do_warn(_t("Image"), _t("Could not display the selected image."));
                        });
                    });
            } else {
                var $img = $(qweb.render("FieldBinaryImage-img", {widget: this, url: url, 'image': img, 'img_360': img_360}));
                this.$('> img').remove();
                this.$el.prepend($img);
                $img.on('error', function () {
                    self.on_clear();
                    $img.attr('src', self.placeholder);
                    self.do_warn(_t("Image"), _t("Could not display the selected image."));
                });
            }
        },
        on_image_clicked: function() {
             console.log(this.recordData.barcode);
             console.log(this);
             var self = this;
//           var image_server = "https://imageserver.partenics.de/odoo/00432780?format=json";
             $.ajax({
                url : 'https://imageserver.partenics.de/odoo/' + self.recordData.barcode + '?format=json',
                type: 'get',
                data : {},
                contentType: false,
                cache: false,
                processData:false
                }).done(function (data) {
                console.log(data);
//                var res = {"success":true,"count":2,"images":[{"id":2600,"previewUrl":"https://imageserver.partenics.de/odoo/view/2600","type":"image"},{"id":2601,"previewUrl":"https://imageserver.partenics.de/odoo/view/2601","type":"360"}]}
                var res = JSON.parse(data);
                var image_arr = res["images"];
                var img_urls = []
                for (var i=0; i<res["count"]; i++) {
                  console.log(image_arr[i]["previewUrl"]);
                  img_urls[i] = image_arr[i]["previewUrl"]
                }

                console.log(img_urls);
                if (img_urls.length > 0) {
                    var dialog = new Dialog(self, {
                        title: self.recordData.name,
                        size: 'large',
                        $content: core.qweb.render('iframe_image_360', {'image_server': img_urls}),
                    }).open();
                } else {
                    self.do_warn(_t('No images found!'));
                }
            });
        }
    });


    field_registry.add('preview_binary_360', FieldPreviewBinary360);

    return FieldPreviewBinary360;

});