'use strict';

let emoteName;

document.querySelector('form').addEventListener('submit', function (event) {
    event.preventDefault();

    let message = document.getElementById('message');

    document.getElementById("submit").disabled = true;
    emoteName = filterEmoteName(document.getElementById('emotename').value);

    let files = document.getElementById('file').files;

    if(files.length === 0) {
        message.innerHTML = 'Please select an emote before submitting.';
        resetSubmit();
        return;
    } else if(emoteName.length === 0) {
        message.innerHTML = 'Please enter an emote name before submitting.';
        resetSubmit();
        return;
    } else {
        message.innerHTML = 'Uploading...';
    }

    uploadFiles(files);
});

document.getElementById('file').onchange = function(e){
    let name = e.target.value;
    let nameField = document.getElementById('emotename');
    if(name !== "") {
        nameField.value = name.split("\\")[2].split(".")[0];
    } else {
        nameField.value = "";
    }
}

function uploadFiles(files) {
    // Creates an array of Promises resolved when the content
    // of the file provided is read successfully.
    let filesPromises = [].map.call(files, readFile);

    return Promise
        .all(filesPromises)
        .then(function(files) {
            if(files.length === 1) {
                $.ajax({
                    url: "/commit",
                    method: "POST",
                    contentType: 'application/json',
                    data: JSON.stringify(files[0])
                })
                .done((data) => {
                    let message = $("#message");

                    if(data === "ok") {
                        message.html('Your file has been saved correctly. \n Refresh your emote database or go <a href="https://yentis.github.io/emotes">here</a> to see your new emote.');
                    } else {
                        message.html(data);
                    }

                    resetSubmit();
                })
                .fail((data, errorName, e) => {
                    console.log(errorName + ": " + e);
                });
            } else {
                resetSubmit();
            }
        });
}

function readFile(file) {
    return new Promise(function (resolve, reject) {
        let fileReader = new FileReader();

        fileReader.addEventListener('load', (event) => {
            let content = event.target.result;
            let extension = '.' + file.name.split('.')[1];
            let img = new Image;
            let width;

            content = atob(content.replace(/^(.+,)/, ''));

            img.src = event.target.result;
            img.addEventListener('load', (event) => {
                width = img.width;

                resolve({
                    emoteName: emoteName,
                    extension: extension,
                    width: width,
                    content: content
                });
            });
        });

        fileReader.addEventListener('error', function (error) {
            reject(error);
        });

        fileReader.readAsDataURL(file);
    });
}

function filterEmoteName(emoteName) {
    if(emoteName.length === 0) {
        return '';
    } else {
        if(emoteName.substring(0, 6) === 'yentis') {
            emoteName = emoteName.substring(6, emoteName.length);
        } else if(emoteName.substring(0, 4) === 'yent') {
            emoteName = emoteName.substring(4, emoteName.length);
        }

        return 'yent' + emoteName.charAt(0).toUpperCase() + emoteName.slice(1);
    }
}

function resetSubmit() {
    document.getElementById("submit").disabled = false;
}
