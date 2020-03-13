$(document).ajaxComplete(function(){
//    console.log($("div.o_form_buttons_view button.btn.btn-primary.btn-sm.o_form_button_edit").length);
//    console.log(window.location.href)
    var arr = window.location.href.toString().split("&");
    // console.log(arr[2].split("=")[1]);
    var is_product = false;
    for (i=1; i <= arr.length - 1; i++) {
        if(arr[i].split("=")[1] == "product.template") {
//            console.log('Template');
            is_product = true;
        }
    }
    if(is_product == true) {
        $('div.oe_avatar').removeClass('o_field_empty');
    }
});