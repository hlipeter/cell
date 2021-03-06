'use strict';

import WebUploader from 'webuploader/dist/webuploader';

import Clipboard from "clipboard/dist/clipboard";



export default function (app) {

    app.directive('validationTest', validationTestDirective);

    //图片裁剪问题
    app.directive('cropper', function ($timeout, Exhibition) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                $timeout(function () {
                    //Exhibition.getUrlToken().then(function (da) {
                    //da.data.upload_domain, da.data.token, da.data.file_name
                        imageUploadFn();
                    //});
                })

                var imageUploadFn = function (domain, token, filename) {
                    var Uploader = (function () {
                        // -------setting-------
                        // 如果使用原始大小，超大的图片可能会出现 Croper UI 卡顿，所以这里建议先缩小后再crop.
                        var FRAME_WIDTH = 800;

                        var _ = WebUploader;
                        var Uploader = _.Uploader;
                        var uploaderContainer = $('.uploader-container');
                        var uploader, file;

                        if (!Uploader.support()) {
                            alert('Web Uploader 不支持您的浏览器！');
                            throw new Error('WebUploader does not support the browser you are using.');
                        }

                        // hook,
                        // 在文件开始上传前进行裁剪。
                        Uploader.register({
                            'before-send-file': 'cropImage'
                        }, {

                            cropImage: function (file) {
                                var data = file._cropData,
                                    image, deferred;

                                file = this.request('get-file', file);
                                deferred = _.Deferred();

                                image = new _.Lib.Image();

                                deferred.always(function () {
                                    image.destroy();
                                    image = null;
                                });
                                image.once('error', deferred.reject);
                                image.once('load', function () {
                                    image.crop(data.x, data.y, data.width, data.height, data.scale);
                                });

                                image.once('complete', function () {
                                    var blob, size;
                                    // 移动端 UC / qq 浏览器的无图模式下
                                    // ctx.getImageData 处理大图的时候会报 Exception
                                    // INDEX_SIZE_ERR: DOM Exception 1
                                    try {
                                        blob = image.getAsBlob();
                                        size = file.size;
                                        file.source = blob;
                                        file.size = blob.size;
                                        file.trigger('resize', blob.size, size);
                                        deferred.resolve();
                                    } catch (e) {
                                        console.log(e);
                                        // 出错了直接继续，让其上传原始图片
                                        deferred.resolve();
                                    }
                                });

                                file._info && image.info(file._info);
                                file._meta && image.meta(file._meta);
                                image.loadFromBlob(file.source);
                                return deferred.promise();
                            }
                        });

                        return {
                            init: function (selectCb) {
                                uploader = new Uploader({
                                    pick: {
                                        id: elem,
                                        multiple: false
                                    },

                                    // 设置用什么方式去生成缩略图。
                                    thumb: {
                                        quality: 70,

                                        // 不允许放大
                                        allowMagnify: false,

                                        // 是否采用裁剪模式。如果采用这样可以避免空白内容。
                                        crop: true
                                    },
                                    auto: true,
                                    duplicate: true,    //重复文件
                                    // 禁掉分块传输，默认是开起的。
                                    chunked: false,
                                    // 禁掉上传前压缩功能，因为会手动裁剪。
                                    compress: false,
                                    formData: {
                                        key: '',
                                       // token: token
                                    },
                                    server: 'http://upload.qiniu.com/',
                                    swf: 'http://cdn.staticfile.org/webuploader/0.1.0/Uploader.swf',
                                    onError: function () {
                                        var args = [].slice.call(arguments, 0);
                                        alert(args.join('\n'));
                                    }
                                });

                                uploader.on('fileQueued', function (_file) {
                                    file = _file;
                                    uploader.makeThumb(file, function (error, src) {
                                        if (error) {
                                            alert('不能预览');
                                            return;
                                        }
                                        selectCb(src);

                                    }, FRAME_WIDTH, 1);   // 注意这里的 height 值是 1，被当成了 100% 使用。
                                });
                            },

                            crop: function (data) {

                                var scale = Croper.getImageSize().width / file._info.width;
                                data.scale = scale;

                                file._cropData = {
                                    x: data.x1,
                                    y: data.y1,
                                    width: data.width,
                                    height: data.height,
                                    scale: data.scale
                                };
                            },

                            upload: function () {
                                uploader.upload();
                            }
                        }
                    })();

// ---------------------------------
// ---------  Crpper ---------------
// ---------------------------------
                    var Croper = (function () {
                        var container = $('.cropper-wraper');
                        var $image = container.find('.img-container img');
                        var btn = $('.upload-btn');
                        var isBase64Supported, callback;

                        $image.cropper({
                            aspectRatio: 9 / 9,
                            preview: ".img-preview",
                            done: function (data) {
                                // console.log(data);
                            }
                        });

                        function srcWrap(src, cb) {

                            // we need to check this at the first time.
                            if (typeof isBase64Supported === 'undefined') {
                                (function () {
                                    var data = new Image();
                                    var support = true;
                                    data.onload = data.onerror = function () {
                                        if (this.width != 1 || this.height != 1) {
                                            support = false;
                                        }
                                    }
                                    data.src = src;
                                    isBase64Supported = support;
                                })();
                            }

                            if (isBase64Supported) {
                                cb(src);
                            } else {
                                // otherwise we need server support.
                                // convert base64 to a file.

                                console.log('preview.php', '请求服务出错');


                                $.ajax('../../server/preview.php', {
                                    method: 'POST',
                                    data: src,
                                    dataType: 'json'
                                }).done(function (response) {
                                    if (response.result) {
                                        cb(response.result);
                                    } else {
                                        alert("预览出错");
                                    }
                                });
                            }
                        }

                        btn.on('click', function () {
                            callback && callback($image.cropper("getData"));
                            return false;
                        });

                        return {
                            setSource: function (src) {

                                // 处理 base64 不支持的情况。
                                // 一般出现在 ie6-ie8
                                srcWrap(src, function (src) {
                                    $image.cropper("setImgSrc", src);
                                });

                                container.removeClass('webuploader-element-invisible');

                                return this;
                            },

                            getImageSize: function () {
                                var img = $image.get(0);
                                return {
                                    width: img.naturalWidth,
                                    height: img.naturalHeight
                                }
                            },

                            setCallback: function (cb) {
                                callback = cb;
                                return this;
                            },

                            disable: function () {
                                $image.cropper("disable");
                                return this;
                            },

                            enable: function () {
                                $image.cropper("enable");
                                return this;
                            }
                        }

                    })();

                    var container = $('.uploader-container');
                    Uploader.init(function (src) {
                        Croper.setSource(src);
                        // 隐藏选择按钮。
                        container.addClass('webuploader-element-invisible');
                        // 当用户选择上传的时候，开始上传。
                        Croper.setCallback(function (data) {
                            Uploader.crop(data);
                            Uploader.upload();
                        });
                    });


                }


            },


        };
    });


    //会展列表翻转动画
    app.directive('hoverTrans', function ($timeout) {
        return {
            restrict: 'A',
            link: function (scope, elem) {
                var isQrCode = false;
                elem.find(".code-img").on("mouseenter", function () {
                    if (!isQrCode) {
                        elem.find(".thumcode").css("z-index", "11").show();
                        elem.css("transform", "rotateY(180deg)");
                        elem.on("webkitTransitionEnd", function () {
                            isQrCode = true;
                        })
                    }
                });
                elem.on('mouseleave', function () {
                        if (isQrCode) {
                            elem.find('.thumcode').css("z-index", "1").hide();
                            elem.css("transform", "rotateY(0deg)");
                            elem.on("webkitTransitionEnd", function () {
                                isQrCode = false;
                            })
                        }
                    }
                );
            },
        };
    });

    //页面刷新提示
    app.directive('refreshLoad', function () {
        return {
            restrict: 'A',
            link: function (scope, elem) {
                $(window).on('beforeunload', function () {
                    return "刷新后本次上传的文件将不显示!";
                });
            },
        };
    });

    //动画定义
    app.directive('slideAnimate', function ($timeout) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.on("click", function () {
                    if (scope.stateMode) {
                        $('.motion').fadeOut(function () {
                            $timeout(function () {
                                scope.stateMode = false;
                            })
                            $(".FILE_ARTICLE").animate({
                                "padding-left": "70px"
                            });
                            $(".FILE_ARTICLE .slide-bar").animate({
                                width: '70px'
                            }, function () {
                                $('.graphic').fadeIn();

                            });

                            $(".nav-bar .left").animate({
                                width: '218px'
                            });
                        });
                    }
                    if (!scope.stateMode) {
                        $('.graphic').fadeOut(function () {
                            $(".nav-bar .left").animate({
                                width: '508px'
                            }, function () {

                            });
                            $(".FILE_ARTICLE").animate({
                                "padding-left": "360px"
                            });
                            $(".FILE_ARTICLE .slide-bar").animate({
                                width: '360px'
                            }, function () {
                                $timeout(function () {
                                    scope.stateMode = true;
                                })
                                $('.motion').fadeIn();
                            })


                        });
                    }
                })
            },
        };
    });

    // 切换专题样式
    app.directive('changeTopicbg', function ($timeout, Exhibition) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.on('click', function () {
                    console.log("attrs.datacss", scope.topicDetails);
                    if (attrs.datacss == "middle") {
                        Exhibition.editTopicDetail({
                            hash: scope.topicDetails.folder_hash,
                            position: "under"
                        }).then(function (res) {
                            console.log(res);
                        })
                        $timeout(function () {
                            scope.topicDetails.property.position = "under";
                        })

                    }
                    if (attrs.datacss == "under") {
                        Exhibition.editTopicDetail({
                            hash: scope.topicDetails.folder_hash,
                            position: "middle"
                        }).then(function (res) {
                            console.log(res);
                        })
                        $timeout(function () {
                            scope.topicDetails.property.position = "middle";
                        })
                    }

                })
            }
        }
    });

    //提交注册信息
    app.directive('registerForm', function (Exhibition, $state, $location) {
        return {
            restrict: 'A',
            link: function (scope, elem) {
                $('.regform .go input').on('focus', function () {
                    $('.regform .col-md-3').empty();
                });

                elem.on('click', function () {
                    var UID = Util.String.getNextStr(window.location.href, "=");
                    console.log(UID, "$stateParams", window.location.href);
                    var name = $(".for_name").val().trim();
                    var firm = $(".for_firm").val().trim();
                    var mobile = $(".for_mobile").val().trim();
                    var code = $(".for_code").val().trim();
                    var incode = $(".for_incode").val().trim();
                    if (name.length < 2 || name == "") {
                        $(".name_vau").text("最少包含2个字符");
                        return;
                    }
                    if (firm.length < 2 || firm == "") {
                        $(".firm_vau").text("最少包含2个字符");
                        return;
                    }
                    if (Util.RegExp.PhoneNumber.test(mobile) == false || mobile == "") {
                        $(".mobile_vau").text("手机号输入错误");
                        return;
                    }
                    if (code.length < 2 || code == "") {
                        $(".code_vau").text("验证码输入错误");
                        return;
                    }
                    if (incode.length < 2 || incode == "") {
                        $(".incode_vau").text("邀请码输入错误");
                        return;
                    }

                    var params = {
                        invitation_code: incode,
                        phone: mobile,
                        verify_code: code,
                        user_id: UID,
                        account: name,
                        org_name: firm
                    };

                    Exhibition.registerFrom(params).then(function (res) {
                        if (res.status) {
                            console.log("跳转的链接", 'http://' + $location.host() + '/admin/#/exhibition');
                            window.location.href = 'http://' + $location.host() + '/admin/#/exhibition';
                        } else {
                            $(".error_msg").text(res.error_msg);
                        }
                    });


                })
            },
        };
    });

    //发送验证码
    app.directive('sendCode', function (Exhibition) {
        return {
            restrict: 'A',
            link: function (scope, elem) {
                elem.on('click', function () {
                    var mobile = $('.for_mobile').val();
                    if (mobile == "" || mobile == undefined || Util.RegExp.PhoneNumber.test(mobile) == false) {
                        $(".mobile_vau").text("手机号输入错误");
                        return false;
                    }
                    elem.prop('disabled', true);

                    //倒计时
                    var timeing = 60;
                    var deltime = function () {
                        if (timeing == 0) {
                            elem.prop('disabled', false);
                            elem.text("获取验证码");
                            timeing = 60;
                        } else {
                            elem.prop('disabled', true);
                            elem.text("重新发送(" + timeing + ")");
                            timeing--;
                            setTimeout(function () {
                                deltime();
                            }, 1000);
                        }
                    }
                    deltime();
                    Exhibition.getcode(mobile).then(function (res) {
                        console.log("验证码", res);
                    });
                });
            },
        };
    });

    //更换会展背景图片
    app.directive('selectBgimg', function ($timeout, Exhibition) {
        return {
            restrict: 'A',
            link: function (scope, elem) {
                elem.on("click", function () {
                    var index = $(this).index();
                    elem.find('i').css("display", "block").parent().siblings().find('i').css("display", "none");
                    var img = elem.find("img").prop("src").replace("-340", "");
                    // $("#changeBannerModal .btn").off("click");
                    // $("#changeBannerModal .btn").on("click", function () {
                    Exhibition.editExTitle({exhibition_id: scope.currentExbt.id, banner: img}).then(function (res) {
                        $timeout(function () {
                            scope.currentExbt.banner = img;
                        })
                        $("#changeBannerModal").modal("hide");
                    })
                    // })
                });
            },
        };
    });


    //复制制定文本信息
    app.directive("copyWebsite", function ($timeout, $rootScope) {
        return {
            restrict: 'A',
            link: function (scope, elem) {
                var clipboard = new Clipboard(elem[0], {
                    text: function (trigger) {
                        console.log(trigger.getAttribute('data-clipboard-text'));
                        return trigger.getAttribute('data-clipboard-text');
                    }
                });
                clipboard.on('success', function (e) {
                    $timeout(function () {
                        $rootScope.alertMsg = true;
                    })
                    $timeout(function () {
                        $rootScope.alertMsg = false;
                    }, 750);
                });
            },
        };
    });


    //删除管理员信息
    app.directive("delManger", function ($timeout, $rootScope, Exhibition) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.on('click', function () {
                    //获取管理员列表
                    Exhibition.delAssistant(attrs.dataid).then(function (res) {
                        console.log("删除管理员信息", res);
                        for (var i = 0; i < $rootScope.magList.length; i++) {
                            if ($rootScope.magList[i].id === attrs.dataid) {
                                $timeout(function () {
                                    $rootScope.magList.splice(i, 1);
                                })
                                break;
                            }
                        }
                    })
                })
            },
        };
    });

    //普通文件上传
    app.directive('uploadFiles', function ($timeout, Exhibition) {
        return {
            restrict: 'A',
            scope: {
                fileList: '=',
                state: '=',
                topDetails: '=',
                exdataFlow: '=',
                currentExbt: '='
            },
            link: function (scope, elem, attrs) {
                $timeout(function () {
                    Exhibition.getFileToken(scope.currentExbt.org_id).then(function (da) {
                        uploadimg(da.data.url, da.data.org_client_id);
                    });
                });
                function uploadimg(url, clientid) {
                    var uploader = WebUploader.create({
                        pick: {
                            id: elem,
                        },
                        auto: true,
                        swf: 'http://cdn.staticfile.org/webuploader/0.1.0/Uploader.swf',
                        server: url,
                        formData: {
                            org_client_id: clientid,
                            name: '',
                            filefield: 'file',
                            file: 'file',
                        },
                        duplicate: true,//重复文件
                        // fileNumLimit: 100,
                        fileSizeLimit: 1024 * 1024 * 1024,  //最大文件 1 个G
                        fileSingleSizeLimit: 10240 * 1024 * 1024 //文件上传总量 10 个G
                    });
                    uploader.on('uploadStart', function () {
                        if (scope.state == "files") {
                            uploader.options.formData.path = scope.currentExbt.base_folder;
                        } else {
                            uploader.options.formData.path = scope.topDetails.title;
                        }
                    });
                    uploader.on('fileQueued', function (file) {
                        console.log("所有队列信息", arguments);
                        uploader.options.formData.name = file.name;
                        $("#uploadFileModal").modal('hide');
                        var thisfile = {
                            indexID: file.id,
                            id: '',
                            ex_id: scope.currentExbt.id,
                            hash: '',
                            size: file.size,
                            property: {
                                style: 1,
                                back_pic: "http://res.meetingfile.com/2168a80ad9c3a8b1a07eb78751e37e4d2491041a.jpg",
                                title: file.name
                            },
                            title: file.name,
                            loadStatus: false
                        };
                        scope.fileList.push(thisfile);
                    });

                    uploader.on('uploadSuccess', function (uploadFile, returnFile) {
                        console.log("文件上传成功", arguments);
                        for (let i = 0; i < scope.fileList.length; i++) {
                            if (scope.fileList[i].indexID == uploadFile.id) {
                                scope.fileList[i].hash = returnFile.hash;
                                scope.fileList[i].property.title = Util.String.baseName(returnFile.fullpath);
                                scope.fileList[i].title = Util.String.baseName(returnFile.fullpath);
                                if (scope.state == "topic")
                                    scope.fileList[i].folder_id = scope.topDetails.id;
                                Exhibition.editFileinfo(scope.fileList[i]).then(function (res) {
                                    $timeout(function () {
                                        scope.fileList[i].id = res.id;
                                        scope.fileList[i].hash = returnFile.hash;
                                        scope.fileList[i].filewidth = 100;
                                    })
                                    scope.exdataFlow.space += returnFile.filesize;
                                    if (scope.state == "topic") {
                                        $timeout(function () {
                                            ++scope.topDetails.file_count;
                                            scope.topDetails.file_size += returnFile.filesize;
                                        })
                                    }
                                });
                            }
                        }
                    });
                    uploader.on('uploadProgress', function (fileObj, progress) {
                        for (let i = 0; i < scope.fileList.length; i++) {
                            if (scope.fileList[i].indexID == fileObj.id) {
                                if (scope.fileList[i].loadStatus) {
                                    uploader.cancelFile(fileObj.id);
                                    $timeout(function () {
                                        scope.fileList.splice(i, 1);
                                    })
                                    break;
                                }
                                scope.$apply(function () {
                                    scope.fileList[i].filewidth = Number(progress) * 92;
                                })
                                break;
                            }
                        }
                    });

                    //不论成功或失败,文件上传完触发
                    uploader.on('uploadComplete', function () {
                        console.log('uploadComplete', arguments);
                    })

                    uploader.on('uploadError', function (fileError) {
                        console.log("上传出错的文件", scope.fileList, fileError);
                        _.each(scope.fileList, function (f) {
                            if (f.indexID == fileError.id) {
                                $timeout(function () {
                                    f.filewidth = 0;
                                    f.loadError = true;
                                })
                            }
                        })
                    })
                    uploader.on('error', function (err) {
                        console.log("文件上传报错", err);
                        //popup.alertDialog("单次上传文件大小不得大于1G.");
                    });
                }
            },
        };
    });

    //上传logo、banner、topicImg
    app.directive('uploadLogo', function ($timeout, Exhibition, $warning, $popupDialog) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                $timeout(function () {
                    Exhibition.getUrlToken().then(function (da) {
                        scope.fileID = '';
                        uploadimg(da.data.upload_domain, da.data.token, da.data.file_name);
                    });
                })

                function uploadimg(server, token, file_name) {
                    var uploader = WebUploader.create({
                        pick: {
                            id: elem,
                            mimeTypes: 'image/*'
                        },
                        auto: true,
                        swf: 'http://cdn.staticfile.org/webuploader/0.1.0/Uploader.swf',
                        server: "http://upload.qiniu.com/",
                        formData: {
                            key: '',
                            token: token
                        },
                        duplicate: true,    //重复文件
                        accept: {
                            title: 'logo',
                            extensions: 'gif,jpg,jpeg,png',
                            mimeTypes: 'image/*'
                        },
                        //fileNumLimit: 100,
                        //fileSizeLimit: 1 * 1024 * 1024,
                        fileSingleSizeLimit: 1 * 1024 * 1024
                    });
                    uploader.on('fileQueued', function (file) {
                        if (attrs.datawhere == "logo") {
                            scope.imgloading = true;
                        }
                        if (scope.fileglobal) {
                            scope.fileID = scope.fileglobal.id;
                        }
                        uploader.options.formData.key = file.name;
                    });
                    uploader.on('uploadSuccess', function () {
                        console.log("图片上传成功", arguments);
                        if (attrs.datawhere == "logo") {
                            var arg = server + "/" + arguments[1].key + "-160";
                            Exhibition.editExTitle({
                                exhibition_id: scope.currentExbt.id,
                                logo: arg
                            }).then(function (res) {
                                $timeout(function () {
                                    scope.currentExbt.logo = arg;
                                    scope.imgloading = false;
                                    $warning("logo更换成功!");
                                })
                            });
                        }
                        if (attrs.datawhere == "banner") {
                            var arg = server + "/" + arguments[1].key;
                            Exhibition.editExTitle({
                                exhibition_id: scope.currentExbt.id,
                                banner: arg
                            }).then(function (res) {
                                $timeout(function () {
                                    scope.currentExbt.banner = arg;
                                    scope.imgloading = false;
                                })
                            })
                        }
                        if (attrs.datawhere === "topicBg") {
                            var arg = server + "/" + arguments[1].key;
                            Exhibition.updateTopicImg({
                                hash: scope.topDetails.folder_hash,
                                img_url: arg,
                                type: 1
                            }).then(function (res) {
                                console.log("封面图片上传成功返回", res);
                                $timeout(function () {
                                    scope.topDetails.img_url.push(arg);
                                })
                            })
                        }
                        if (attrs.datawhere == "fileimg") {
                            var arg = server + "/" + arguments[1].key;
                            if (!scope.fileID) {
                                return;
                            }
                            Exhibition.editFileinfo({
                                file_id: scope.fileID,
                                back_pic: arg
                            }).then(function (res) {
                                if (scope.uploadstate === "files")
                                    _.each(scope.FilesList, function (f) {
                                        if (f.id == scope.fileID) {
                                            $timeout(function () {
                                                f.property.back_pic = arg;
                                            })
                                        }
                                    });
                                if (scope.uploadstate === "topic")
                                    _.each(scope.topDetails.lists, function (t) {
                                        if (t.id == scope.fileID) {
                                            $timeout(function () {
                                                t.property.back_pic = arg;
                                            })
                                        }
                                    });

                            })
                        }
                    });
                    uploader.on('error', function (err) {
                        console.log("图片上传报错", err);
                        //$popupDialog.alertDialog("单次上传文件大小不得大于1G.");
                        alert("上传有误! \n\n 温馨提示您:您上传的图片不得大于1MB。");
                    });
                }
            },


        };
    });

    //替换文件
    app.directive('replaceFiles', function ($timeout, Exhibition) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                $timeout(function () {
                    Exhibition.getFileToken(scope.currentExbt.org_id).then(function (da) {
                        uploadimg(da.data.url, da.data.org_client_id);
                    });
                });
                function uploadimg(url, clientid) {
                    var uploader = WebUploader.create({
                        pick: {
                            id: elem,
                        },
                        auto: true,
                        swf: 'http://cdn.staticfile.org/webuploader/0.1.0/Uploader.swf',
                        server: url,
                        formData: {
                            org_client_id: clientid,
                            name: '',
                            filefield: 'file',
                            file: 'file',
                        },
                        duplicate: true,//重复文件
                        // fileNumLimit: 100,
                        fileSizeLimit: 1024 * 1024 * 1024,  //最大文件 1 个G
                        fileSingleSizeLimit: 10240 * 1024 * 1024 //文件上传总量 10 个G
                    });
                    uploader.on('uploadStart', function () {
                        $(".slide-note").find(".defaults").show().siblings().hide();
                        uploader.options.formData.path = scope.currentExbt.base_folder;
                    });
                    uploader.on('fileQueued', function (file) {
                        uploader.options.formData.name = file.name;
                        scope.fileglobal.property.title = file.name;
                        scope.fileglobal.indexID = file.id;
                        $("#uploadFileModal").modal('hide');
                    });

                    uploader.on('uploadSuccess', function (uploadFile, returnFile) {
                        console.log("成功后的返回", uploadFile, returnFile);
                        const parmas = {
                            org_id: scope.currentExbt.org_id,
                            file_id: scope.fileglobal.id,
                            hash: returnFile.hash,
                            title: Util.String.baseName(returnFile.fullpath),
                            size: returnFile.filesize
                        }
                        if (scope.uploadstate === 'topic') {
                            parmas.folder_id = scope.topDetails.id;
                        }
                        Exhibition.replaceFileinfo(parmas).then(function () {
                            if (scope.uploadstate === "files")
                                _.each(scope.FilesList, function (f) {
                                    if (f.indexID == uploadFile.id) {
                                        $timeout(function () {
                                            scope.ExDataflow.space = scope.ExDataflow.space - Number(f.size) + returnFile.filesize;
                                            f.filewidth = 100;
                                            f.property.title = Util.String.baseName(returnFile.fullpath);
                                            f.property.hash = returnFile.hash;
                                            f.size = returnFile.filesize;
                                        })
                                    }
                                });
                            if (scope.uploadstate === "topic")
                                _.each(scope.topDetails.lists, function (t) {
                                    if (t.indexID == uploadFile.id) {
                                        $timeout(function () {
                                            scope.ExDataflow.space = scope.ExDataflow.space - Number(t.size) + returnFile.filesize;
                                            t.filewidth = 100;
                                            t.property.title = Util.String.baseName(returnFile.fullpath);
                                            t.property.hash = returnFile.hash;
                                            t.size = returnFile.filesize;
                                        })
                                    }
                                });
                        })
                    });
                    uploader.on('uploadError', function (fileError) {
                        if (scope.uploadstate === "files")
                            _.each(scope.FilesList, function (f) {
                                if (f.indexID == fileObj.id) {
                                    f.filewidth = 0;
                                    f.loadError = true;
                                    f.property.title = f.oldtitle;
                                }
                            });
                        if (scope.uploadstate === "topic")
                            _.each(scope.topDetails.lists, function (t) {
                                if (t.indexID == fileObj.id) {
                                    t.filewidth = 0;
                                    t.loadError = true;
                                    t.property.title = t.oldtitle;
                                }
                            });


                    })

                    uploader.on('uploadProgress', function (fileObj, progress) {
                        if (scope.uploadstate == "files")
                            _.each(scope.FilesList, function (r) {
                                if (r.indexID == fileObj.id) {
                                    console.log("进度FilesList", r);
                                    if (r.loadStatus) {
                                        uploader.cancelFile(fileObj.id);
                                        scope.$apply(function () {
                                            r.filewidth = 0;
                                            r.property.title = r.oldTitle;
                                            //r.loadError = true;
                                        })
                                    } else {
                                        scope.$apply(function () {
                                            console.log(" 进度显示", r.filewidth);
                                            r.filewidth = Number(progress) * 92;
                                        })
                                    }
                                }
                            });
                        if (scope.uploadstate == "topic")
                            _.each(scope.topDetails.lists, function (t) {
                                if (t.indexID == fileObj.id) {
                                    if (t.loadStatus) {
                                        uploader.cancelFile(fileObj.id);
                                        scope.$apply(function () {
                                            t.filewidth = 0;
                                            t.property.title = t.oldTitle;
                                            //t.loadError = true;
                                        })
                                    } else {
                                        scope.$apply(function () {
                                            t.filewidth = Number(progress) * 92;
                                        })
                                    }
                                }
                            });


                    });
                    uploader.on('error', function (err) {
                        console.log("文件上传报错", err);
                        alert("上传有误! \n\n 温馨提示您:单次上传文件大小不得大于1G。");
                    });

                }


            },


        };
    });


    //修改会展名称
    app.directive('editExtitle', function (Exhibition, $timeout, $warning, $rootScope) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                var types = "", lastname = '', groname = '', topicname = '';
                elem.on("click", function () {
                    types = attrs.datatype;
                    if (types == "title")
                        lastname = scope.currentExbt.title;      //$.extend({},scope.currentExbt.title);
                    if (types == 'groupname')
                        groname = scope.groupglobal.name;
                    if (types == 'topicname')
                        topicname = scope.topDetails.title;
                })
                elem.on('blur', function () {
                    if (types == "title") {
                        if (lastname != scope.currentExbt.title && scope.currentExbt.title.length) {
                            Exhibition.editExTitle({
                                exhibition_id: scope.currentExbt.id,
                                title: scope.currentExbt.title
                            }).then(function (res) {
                                $warning("站点名称修改成功!");
                                $rootScope.projectTitle = scope.currentExbt.title + " - 会文件";
                            })
                        } else {
                            scope.$apply(function () {
                                scope.currentExbt.title = lastname;
                            })
                        }
                    }
                    if (types == "sub_title") {
                        Exhibition.editExTitle({
                            exhibition_id: scope.currentExbt.id,
                            sub_title: scope.currentExbt.property.sub_title
                        }).then(function (res) {
                            $warning();
                        })
                    }
                    if (types == "groupname") {     //分组名称修改
                        if (groname != scope.groupglobal.name && scope.groupglobal.name.length) {
                            Exhibition.editGroupInfo({
                                group_id: scope.groupglobal.id,
                                name: scope.groupglobal.name
                            }).then(function () {
                                $warning("分组名称修改成功!");
                            })
                        } else {
                            scope.$apply(function () {
                                scope.groupglobal.name = groname;
                            })
                        }
                    }
                    if (types == 'topicname') {     //专题名称修改
                        if (topicname != scope.topDetails.title && scope.topDetails.title.length) {
                            Exhibition.editExFilename({
                                org_id: scope.currentExbt.org_id,
                                fullpath: scope.topDetails.oldtitle,
                                hash: scope.topDetails.folder_hash,
                                newpath: scope.topDetails.title
                            }).then(function () {
                                $warning("专题名称修改成功!");
                            })
                        } else {
                            scope.$apply(function () {
                                scope.topDetails.title = topicname;
                            })

                        }
                    }
                })
            }
        }
    });


    //修改常用文件信息----文件名称
    app.directive("editFilename", function ($timeout, Exhibition, $warning) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.on('click', function () {
                    var element = $(".filemask .preview .name");
                    var lastname = scope.fileglobal.property.title;
                    scope.$apply(function () {
                        scope.fileglobal.isEdit = true;
                    })
                    var selectionEnd = lastname.length;
                    var lenIndex = lastname.lastIndexOf('.');
                    if (lenIndex > 0) {
                        selectionEnd = lenIndex;
                    }
                    element.find('input')[0].selectionStart = 0;
                    element.find('input')[0].selectionEnd = selectionEnd;
                    element.find('input').focus();
                    element.find('input').blur(function () {
                        if (scope.fileglobal.property.title == '') {
                            scope.$apply(function () {
                                scope.fileglobal.isEdit = false;
                                scope.fileglobal.property.title = lastname;
                            })
                            alert("文件名称不能为空!");
                            return;
                        }
                        console.log(lastname, "打印", scope.fileglobal.property.title);
                        if (lastname != scope.fileglobal.property.title) {
                            Exhibition.editFileinfo({
                                file_id: scope.fileglobal.id,
                                title: scope.fileglobal.property.title
                            }).then(function () {
                                $warning()
                            });
                        }
                        $timeout(function () {
                            scope.fileglobal.isEdit = false;
                        })
                    })
                })
            },
        };
    });


    //修改常用文件信息----内容摘要
    app.directive("editFilesubname", function ($timeout, Exhibition, $warning) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.blur(function () {
                    var subname = scope.fileglobal.property.sub_title;
                    Exhibition.editFileinfo({
                        file_id: scope.fileglobal.id,
                        sub_title: scope.fileglobal.property.sub_title
                    }).then(function () {
                        $warning("");
                    })
                })
            },
        };
    });


    //修改常用文件信息----样式
    app.directive("selectFilestyle", function ($timeout, Exhibition) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.on('click', function () {
                    elem.addClass("active").siblings().removeClass("active");
                    var st = attrs.datastyle;
                    if (scope.fileglobal.property.style != st) {
                        Exhibition.editFileinfo({file_id: scope.fileglobal.id, style: st}).then(function (res) {
                            $timeout(function () {
                                scope.fileglobal.property.style = st;
                            })
                        })
                    }
                })
            },
        };
    });


    //创建新分组
    app.directive('addGroup', function (Exhibition, $timeout) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.click(function () {
                    for (var i = 0; i < scope.GroupList.length; i++) {
                        if (scope.GroupList[i].name == "新分组") {
                            alert("请先给原始分组命名!");
                            return false;
                            break;
                        }
                    }
                    scope.group_loding = true;
                    Exhibition.addNewGroup(scope.currentExbt.id).then(function (res) {
                        ++scope.ExDataflow.group;
                        res.folder = [];
                        scope.GroupList.push(res);
                        scope.group_loding = false;
                        scope.groupglobal = res;
                        $(".slide-note").find(".grouping").show().siblings().hide();
                        var input = $(".grouping .group-name");
                        input.focus().select();
                        input.blur(function () {
                            if (scope.groupglobal.name != "新分组") {
                                Exhibition.editGroupInfo({
                                    group_id: scope.groupglobal.id,
                                    name: scope.groupglobal.name
                                })
                            }
                        })
                    })
                })

            },
        };
    });


    //添加专题 filesortAdd
    app.directive('groupToggle', function (Exhibition, $timeout) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.click(function () {
                    $(this).toggleClass("active");
                    $(this).parent().siblings().stop().slideToggle();
                })
            }
        };
    });


    //修改专题   -- set-topic-style 样式
    app.directive('setTopicStyle', function (Exhibition, $timeout) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.on("click", function () {
                    var dt = attrs.dtype;
                    Exhibition.editTopicDetail({
                        hash: scope.topDetails.folder_hash,
                        position: dt
                    }).then(function (res) {
                        $timeout(function () {
                            scope.topDetails.property.position = dt;
                        })
                    })


                })
            }
        };
    });


    //从云库中选择文件
    app.directive('gokuaiCloud', function (Exhibition, $timeout) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.click(function () {
                    console.log("attrs", attrs);
                    try {
                        var el = document.createElement('script');
                        el.src = location.protocol + '//yunku.goukuai.cn/widget/index?_' + Math.random();
                        el.type = 'text/javascript';
                        document.body.appendChild(el);
                        el.onload = el.onreadystatechange = function () {
                            if (!/*@cc_on!@*/0 || this.readyState == 'loaded' || this.readyState == 'complete') {
                                new GKC({
                                    //options
                                    client_id: '60f3cd399bffa0b9a13926689d0a5cca',
                                    style: {
                                        'borderRadius': '3px',
                                        'MozBorderRadius': '3px',
                                        'WebkitBorderRadius': '3px',
                                        'borderColor': '#fff',
                                        'borderWidth': '0',
                                        'borderStyle': 'solid',
                                        'backgroundColor': '#fff',
                                        'position': 'fixed',
                                        'top': '30px',
                                        'left': '50%',
                                        'margin-left': '-305px',
                                        'height': '560px',
                                        'width': '610px',
                                        'zIndex': 99999
                                    },
                                    ok: function (obj) {
                                        var newfiles = obj[0];
                                        console.log("从云库上传文件", newfiles);
                                        var pms = {
                                            org_id: scope.currentExbt.org_id,
                                            ex_id: scope.currentExbt.id,
                                            files: []
                                        };
                                        var filename = Util.String.baseName(newfiles.fullpath);
                                        pms.files.push({
                                            filename: filename,
                                            hash: newfiles.filehash,
                                            size: newfiles.filesize
                                        });
                                        if (scope.uploadstate == "files") {
                                            Exhibition.copyFilFromHad(pms).then(function (res) {
                                                _.each(res, function (r) {
                                                    r.property = JSON.parse(r.property);
                                                    scope.FilesList.push(r);
                                                })
                                                $("#uploadFileModal").modal('hide');
                                            })
                                        }
                                        if (scope.uploadstate == "topic") {
                                            pms.folder_id = scope.topDetails.id;
                                            Exhibition.copyFilFromHad(pms).then(function (res) {
                                                console.log("专题云库上传", res);
                                                _.each(res, function (r) {
                                                    r.property = JSON.parse(r.property);
                                                    scope.topDetails.lists.push(r);
                                                })
                                                ++scope.topDetails.file_count;
                                                scope.topDetails.file_size += newfiles.filesize;
                                                $("#uploadFileModal").modal('hide');
                                            });
                                        }
                                        scope.ExDataflow.space += newfiles.filesize;
                                    }
                                });
                            }
                        }
                    } catch (e) {
                        console.log(e);
                    }

                })

            },
        };
    });


    //资料收集夹文件上传
    app.directive('collectUpload', function ($timeout, Exhibition) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {

                $timeout(function () {
                    Exhibition.getFileToken(attrs.dataorgid).then(function (da) {
                        uploadimg(da.data.url, da.data.org_client_id);
                    });
                });

                function uploadimg(url, clientid) {
                    var uploader = WebUploader.create({
                        pick: {
                            id: elem,
                        },
                        auto: true,
                        swf: 'http://cdn.staticfile.org/webuploader/0.1.0/Uploader.swf',
                        server: url,
                        formData: {
                            org_client_id: clientid,
                            name: '',
                            filefield: 'file',
                            file: 'file',
                            path: ''
                        },
                        duplicate: true,//重复文件
                        fileSizeLimit: 1024 * 1024 * 1024,  //最大文件 1 个G
                        fileSingleSizeLimit: 10240 * 1024 * 1024 //文件上传总量 10 个G
                    });
                    uploader.on('fileQueued', function (file) {
                        uploader.options.formData.path = attrs.datacollect;
                        uploader.options.formData.name = file.name;
                        $timeout(function () {
                            scope.fileCollect.push({
                                filename: file.name,
                                fullpath: attrs.datacollect + '/' + file.name,
                                filesize: file.size,
                                filewidth: 0,
                                create_dateline: Date.parse(new Date()),
                                wid: file.id
                            })
                        })
                    });
                    uploader.on('uploadSuccess', function (uploadFile, returnFile) {

                        console.log("上传成功", arguments, scope.fileCollect);

                    });
                    uploader.on('uploadProgress', function (fileObj, progress) {
                        // console.log("上传进度", arguments);
                        var file = _.findWhere(scope.fileCollect, {
                            wid: fileObj.id
                        });
                        var index = "";
                        _.each(scope.fileCollect, function (r) {
                            if (r.wid == fileObj.id) {
                                index = scope.fileCollect.indexOf(r);
                            }
                        });
                        let element = $(".C_fileList ul li:nth-child(" + (index + 1) + ")").find(".diff i");
                        element.off('click');
                        element.on('click', function () {
                            uploader.cancelFile(fileObj.id);
                            scope.$apply(function () {
                                scope.fileCollect.splice(index, 1);
                            })
                        });
                        if (file) {
                            scope.$apply(function () {
                                file.filewidth = Number(progress) * 100;
                            })
                        }

                    });
                    uploader.on('error', function (err) {
                        console.log("文件上传报错", err);
                        alert("上传有误! \n\n 温馨提示您:单次上传文件大小不得大于1G。");
                    });

                }


            },


        };
    });

    //从资料收集中选择文件
    app.directive('selectFilesBycollect', function ($timeout, Exhibition) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.on('click', function () {
                    $("#uploadFileModal").modal('hide');
                    scope.dataCollectList = [];
                    scope.dataCollectList.selectAll = false;
                    if (scope.currentExbt.res_collect_lock == 0) {
                        $("#openCollectFile").modal('show');
                        return;
                    }
                    scope.collectLoading = true;
                    $("#fileFromCollect").modal('show');
                    Exhibition.getDirFilesByID({
                        org_id: scope.currentExbt.org_id,
                        fullpath: scope.currentExbt.res_collect
                    }).then(function (res) {
                        console.log("资料收集夹信息", res);
                        $timeout(function () {
                            scope.collectLoading = false;
                            _.each(res.list, function (r) {
                                r.selects = false;
                            })
                            scope.dataCollectList = res.list;
                        })
                    });
                })
            }
        }
    })


    //从已有文件中选取文件
    app.directive('selectUpload', function ($timeout, Exhibition) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.on('click', function () {
                    $("#uploadFileModal").modal('hide');
                    scope.dataExsitList = [];
                    scope.dataExsitList.selectAll = false;
                    $("#fileFromExist").modal('show');
                    scope.collectLoading = true;
                    console.log("进行专题分类文件选择", scope.uploadstate);
                    var paras = {
                        ex_id: scope.currentExbt.id,
                        has_col: scope.currentExbt.res_collect_lock
                    }
                    if (scope.uploadstate === "files") {
                        Exhibition.getAllOfFile(paras).then(function (res) {
                            $timeout(function () {
                                scope.collectLoading = false;
                                _.each(res, function (re) {
                                    re.selects = false;
                                    re.property = JSON.parse(re.property);
                                })
                                scope.dataExsitList = res;
                            })
                        })

                    }
                    if (scope.uploadstate === "topic") {
                        paras.folder_id = scope.topDetails.id
                        Exhibition.getAllOfFile(paras).then(function (res) {
                            $timeout(function () {
                                scope.collectLoading = false;
                                _.each(res, function (re) {
                                    re.selects = false;
                                    re.property = JSON.parse(re.property);
                                })
                                scope.dataExsitList = res;
                            })
                        })
                    }
                })

            }
        }
    })


    function validationTestDirective() {
        'ngInject';

        return {
            restrict: 'A',
            link: linkFn,
            require: 'ngModel'
        };

        function linkFn(scope, elem, attrs, ngModelCtrl) {
            scope.$watch(attrs.ngModel, function (newVal) {
                if (newVal === 'test') {
                    ngModelCtrl.$setValidity('test', true);
                } else {
                    ngModelCtrl.$setValidity('test', false);
                }
            });
        }
    }
}