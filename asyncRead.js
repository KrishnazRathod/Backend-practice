const fs = require('fs').promises;

console.log("Starting file read");

fs.readFile('sample.txt', 'utf8').then((data) => {
    console.log("File read successfully");
}).catch((err) => {
    console.log("Error reading file");
    console.log(err);
});

console.log("This log happens *before* file is read (demonstrates async behavior");