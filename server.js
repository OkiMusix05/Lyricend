//CUSTOM SERVER ISN'T NEEDED ANY MORE SINCE I'M USING FIREBASE TO HANDLE THE BACKEND
/*const express = require('express');
const app = express();
const fs = require('fs');
const bodyParser = require('body-parser');
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.put('/songs.json', (req, res) => {
    fs.writeFile('public/songs.json', JSON.stringify(req.body, null, 2), (err) => {
        if (err) {
            console.error(err);
            res.sendStatus(500);
        } else {
            console.log('File updated successfully');
            fs.readFile('public/songs.json', 'utf8', (err, data) => {
                if (err) {
                    console.error(err);
                    res.sendStatus(500);
                } else {
                    res.json(JSON.parse(data));
                }
            });
        }
    });
});

// Serve static files from the React app
app.use(express.static('./build'));

// Catch-all route to serve the React app
app.get('*', (req, res) => {
    const path = require('path');
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
*/