function trancelate(r) {

    // Translation mode
    const tmode = true;//true;
    // Save translation data mode
    const cmode = false;

    const trtable_org = nhMessage_org();
    const trtable_answar = nhMessage_jp();
    
    let buf = [];

    if (Boolean(localStorage.getItem("nh.temp"))) {
        buf = JSON.parse(localStorage.getItem("nh.temp"));
    }

    this.message = (msg) => {
        return get_translation_data(msg);
    }

    function get_translation_data(msg) {

        if (tmode == false) return msg;

        let idx = trtable_org.indexOf(msg); //console.log(idx);

        if (idx != -1) {
            return trtable_answar[idx];
        }
        save_translation_data(msg);
        return msg;
    }
    function save_translation_data(msg) {

        if (buf.includes(msg) == false){
            buf.push(msg);
            if (cmode) localStorage.setItem("nh.temp", JSON.stringify(buf));
        }
    }
}