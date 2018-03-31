
// Preview uploaded image before submitting
function handleFileSelect(evt) {
    var files = evt.target.files; // FileList object

    // Get first element of the FileList and render image file as a thumbnail.
    f = files[0];

    // Only process image files.
    if (!f.type.match('image.*')) {
        return;
    }

    var reader = new FileReader();

    // Closure to capture the file information.
    reader.onload = (function(theFile) {
        return function(e) {
            // Render thumbnail.
            document.getElementById("image").src = e.target.result;
        };
    })(f);

    // Read in the image file as a data URL.
    reader.readAsDataURL(f);
}        