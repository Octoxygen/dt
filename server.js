// require("dotenv").config;

import express from "express";
import mysql from "mysql";
import cors from "cors";


const app = express();

app.use(express.json())
app.use(cors())

const db = mysql.createConnection({
    host: process.env.DB_HOST, // "localhost"
    user: process.env.DB_USER, // "root"
    database: process.env.DB_NAME // "docutracker"
})

const getDateToday = () => {
    let date = new Date()
    const year = date.getFullYear().toString()
    const month = (date.getMonth() + 1).toString().padStart(2, 0)
    const day = (date.getDate()).toString().padStart(2, 0)
    return {
        std: year + "-" + month + "-" + day,
        pref: year + "-" + month + day,
    }
}

const generateID = (seq) => {
    return getDateToday().pref + "-" + seq.toString().padStart(3, 0)
}

app.get("/", (req, res) => {
    res.json("hello i am data")
})

app.get("/users", (req, res) => {
    const q = "SELECT COUNT(document_id) as 'count' from `documents`";
    db.query(q, (err, data) => {
        if (err) return res.json(err);
        return res.json(data[0].count);
    })
})

app.post("/login", (req, res) => {
    const in_username = req.body.username;
    const in_password = req.body.password;
    // console.log(in_username)
    // console.log(in_password)
    const q = "SELECT * FROM `users` WHERE username = '" + in_username + "' AND password = '" + in_password + "'"

    db.query(q, (err, data) => {
        if (err) return res.json(err);
        return res.json({
            test: data.length == 1? true: false,
            data,
        });
    })
})

app.get("/generate-id", (req, res) => {
    const today = getDateToday()

    const q = "SELECT COUNT(document_id) as 'count' from `documents` WHERE `date_id_generated` >= ?"

    db.query(q, [today.std], (err, data) => {
        if (err) return res.json(err);
        return res.json(data[0].count);
    })
})

app.post("/add-draft", (req, res) => {
    const seq = req.body.seq
    console.log(seq)
    const id = generateID(seq)

    console.log(id)

    const q = "INSERT INTO `documents` (`document_id`, `creator`) VALUES (?)"
    const val = [
        id,
        req.body.user
    ]

    db.query(q, [val], (err, data) => {
        if (err) return res.json(err);
        return res.json(id);
    })
})

app.put("/publish", (req, res) => {
    const q = "UPDATE `documents` SET `document_title` = ?, `status` = ? WHERE `document_id` = ?"

    const val = [
        req.body.title,
        'pub',
        req.body.id
    ]

    db.query(q, [...val], (err, data) => {
        if (err) return res.json(err);
        return res.json("Document added successfully!");
    })
})

app.post("/add-initial-transfer", (req, res) => {
    const q = "INSERT INTO `transfer_history` (`document_id`, `transfer_department_id`, `received_by`) VALUES (?)"

    const val = [
        req.body.id,
        req.body.origin,
        req.body.creator
    ]

    console.log('History recorded');
    console.log(val);

    db.query(q, [val], (err, data) => {
        if (err) return res.json(err);
        return res.json("Origin added successfully")
    })
})

app.post("/transfer", (req, res) => {
    const q = "INSERT INTO `transfer_history` (`document_id`, `transfer_department_id`, `received_by`) VALUES (?)"

    const val = [
        req.body.id,
        req.body.origin,
        req.body.creator
    ]

    console.log('History recorded');
    console.log(val);

    db.query(q, [val], (err, data) => {
        if (err) return res.json(err);
        return res.json("Origin added successfully")
    })
})

app.get("/get-user-documents/:user", (req, res) => {
    const user = req.params.user

    console.log(user)

    var q = "DROP TEMPORARY TABLE IF EXISTS a;"
    db.query(q, (err, data) => {
        if (err) return res.json(err);
    })

    var q = "DROP TEMPORARY TABLE IF EXISTS b;"
    db.query(q, (err, data) => {
        if (err) return res.json(err);
    })

    var q = "CREATE TEMPORARY TABLE a SELECT th.document_id from transfer_history th INNER JOIN ( SELECT document_id FROM `transfer_history` WHERE received_by = ? GROUP BY document_id ) dx ON th.document_id = dx.document_id GROUP BY th.document_id;"
    db.query(q, [user], (err, data) => {
        if (err) return res.json(err);
    })

    var q = "CREATE TEMPORARY TABLE b SELECT MAX(th.transfer_id) AS transfer_id, document_id FROM transfer_history th GROUP BY th.document_id ASC;"
    db.query(q, [user], (err, data) => {
        if (err) return res.json(err);
    })

    q = "SELECT b.*, th.transfer_department_id, d.document_title, d.date_created, d.creator, CONCAT(u.name_given, ' ', u.name_middle_initial, '. ', u.name_last) as 'name', dp.name as 'location' FROM a INNER JOIN b ON a.document_id = b.document_id INNER JOIN transfer_history th ON th.transfer_id = b.transfer_id INNER JOIN documents d on d.document_id = b.document_id INNER JOIN users u on d.creator = u.user_id INNER JOIN departments dp ON dp.department_id = th.transfer_department_id;"

    db.query(q, (err, data) => {
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.get("/get-all-documents", (req, res) => {
    var q = "DROP TEMPORARY TABLE IF EXISTS latest_dates;"
    db.query(q, (err, data) => {
        if (err) return res.json(err);
    })

    var q = "CREATE TEMPORARY TABLE latest_dates SELECT * FROM transfer_history th GROUP BY th.document_id DESC;"
    db.query(q, (err, data) => {
        if (err) return res.json(err);
    })

    q = "SELECT d.document_id, d.document_title, d.date_created, d.creator, CONCAT(u.name_given, ' ', u.name_middle_initial, '. ', u.name_last) as 'name', dp.name AS 'location', ld.received_by FROM documents d INNER JOIN latest_dates ld USING(document_id) INNER JOIN departments dp ON ld.transfer_department_id = dp.department_id INNER JOIN users u ON d.creator = u.user_id ORDER BY d.date_created;"

    db.query(q, (err, data) => {
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.get("/get-history/:id", (req, res) => {
    const id = req.params.id

    const q = "SELECT th.transfer_id, th.received_by, CONCAT(u.name_given, ' ', u.name_middle_initial, '. ', u.name_last) as 'name', th.date_received, dc.name AS 'location', LAG(th.date_received, -1) OVER (ORDER BY th.date_received) AS 'date_departed' FROM transfer_history th INNER JOIN documents d ON d.document_id = th.document_id AND d.document_id = ? INNER JOIN users u ON u.user_id = th.received_by INNER JOIN departments dc ON dc.department_id = th.transfer_department_id ORDER BY date_received DESC"

    db.query(q, id, (err, data) => {
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.listen(8900, () => {
    console.log("Connected to database");
})