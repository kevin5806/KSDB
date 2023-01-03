const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

//rende possibile il salvataggio delle sessioni in dei file nella memoria del server
//const FileStore = require('session-file-store')(session);//



//creazione dell app
const app = express();

//parametri del server
const PORT = process.env.PORT || 3000;

//abilita i proxy
/*
app.enable('trust proxy');

//reinderizza tutte le richieste http ad https
app.use(function(request, response, next) {

    if (!request.secure) {
       return response.redirect("https://" + request.headers.host + request.url);
    }
    next();
})
*/

//imposto la cartella e la engine di render
app.set('view engine', 'ejs');

//funzione usata per creare una sessione
app.use( session ({
    
    //store: new FileStore(),
    secret: '?E(H+KbPeShVmYq3', //chiave di criptazione per le sessioni
    secure: true,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 86400000 //1 giorno
    }

}));

// utilizzo delle librerie express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//server per servire file statici accessibili da tutte le pagina del sito
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {

    res.sendFile(__dirname + '/index.html');

})

// route root di reindirizzamento all pagin principale
app.get('/dashboard', (req, res) => {


    if (req.session.auth === true) { //verifica l'autenticazione

        fs.readFile('data/data.json', 'utf8', (err, Json) => { 
            if (err) throw err;

            let data = JSON.parse(Json);

            //error = 1 > campi di input vuoti
            //error = 2 > imput inserito nel edit non valido
            res.render('index', {array: data, error: req.query.error, errorID: req.query.id});
        });
    

    } else { //se non autenticato

        res.redirect('/login');

    }
})


// route di redirect all pagina di login
app.get('/login', (req, res) => {

    //error = 1 > password/utente errati
    res.render('login', {error: req.query.error} );

})

app.get('/logout', (req, res) => {

    req.session.auth = false;

    req.session.destroy((err) => {

        if (err) {
            res.send("Server error");
        } else {
            res.redirect('/dashboard');
        }

    })

})

app.post('/login', (req, res) => {

    //verifica se nome utente e password inviati dal front sono corretti
    if (req.body.user === "u" && req.body.pass === "p") {
        
        req.session.auth = true;

        //reinderizzamento alla pagina principale dove avverrà nuovamente il controllo sul autenticazione
        res.redirect('/dashboard');
    
    } else {
        
        //reinderizza passando un errore
        res.redirect('/login?error=1');

    }
})

// route per l'aggiunta di nuovi dati
app.post('/data', (req, res) => {

    //verifica l'autenticazione
    if (req.session.auth === true) {

        let sum = Number(req.body.sum), name = req.body.name, sign = Number(req.body.sign);  
        
        // controlla se i campi di input sono vuoti o che non sia stata inserita una somma numerica
        if (typeof sum == "number" && !isNaN(sum) && name != "" && (sign == 1 || sign == 2)) {

            fs.readFile('data/main.json', 'utf8', (err, inJS) => { // legge il file json
                if (err) throw err;
                
                //converte i dati json in una stringa di oggetti
                let data = JSON.parse(inJS);
                
                //incremento del id
                data.id++;
                
                fs.readFile('data/data.json', 'utf8', (err, storedJson) => { // legge il file json
                    if (err) throw err;
                    
                    //converte i dati json in una stringa di oggetti
                    let storeData = JSON.parse(storedJson);

                    if (sign == 1) { //sottrai
                        
                        //rende il numero negativo
                        sum = Math.abs(sum);
                        sum = sum * -1;

                    } else if (sign == 2) { // somma
                        
                        //rende il numero positivo
                        sum = Math.abs(sum);

                    }
    
                    //crea un oggetto con i nuovi dati
                    let dataAdd = {
                        id: data.id,
                        name: name,
                        sum: sum
                    }
                    
                    //aggiunge alla fine della stringa il nuovo oggetto
                    storeData.unshift(dataAdd); //possibile errore
                    
                    //converte nuovamente il nuovo oggetto in Json
                    let newJsonData = JSON.stringify(storeData);
                    
                    //riscrive interamente il file Json con i nuovi dati
                    fs.writeFile('data/data.json', newJsonData, (err) => { if (err) throw err; });
                });

                //converte nuovamente il nuovo oggetto in Json
                let outJS = JSON.stringify(data);
                
                //riscrive interamente il file Json con i nuovi dati
                fs.writeFile('data/main.json', outJS, (err) => { if (err) throw err; });
            });

            //reindirizzamento alla pagina principale
            res.redirect('/dashboard');

        //se i campi di input sono vuoti
        } else {
            
            //reinderizza passando un errore
            res.redirect('/dashboard?error=1')

        }
        
    } else {
        
        res.redirect('/login')
        
    }
})


// route per la modifica dei dati gia presenti
app.post('/dataedit', (req, res) => {

    if (req.session.auth === true) { //verifica l'autenticazione

        let id = Number(req.body.id), sum = Number(req.body.sum), 
            operation = Number(req.body.operation), sBtn = Number(req.body.sBtn),
            sign = Number(req.body.sign);

        if (((typeof id === "number" && !isNaN(id) && id != "") 
        && (typeof sum === "number" && !isNaN(sum) && (sum != "" || operation == 2 || sBtn == 2))) 
        && (operation == 1 || operation == 2)
        && (sBtn == 1 || sBtn == 2)
        && (sign == 1 || sign == 2)
        ) {

            fs.readFile('data/data.json', 'utf8', (err, JSin) => { // legge il file json
                if (err) throw err;
                
                //converte i dati json in una stringa di oggetti
                let dataIN = JSON.parse(JSin);
                let upData;

                if (sBtn == 2) { // form inviato con il pulsante delete
                        //dati aggiornati
                        upData = dataIN;
                        let index = upData.findIndex((data) => data.id === id);
                        if (index !== -1) { upData.splice(index, 1) }

                } else if (sBtn == 1) { // form inviato con il pulsante normale
                    
                    if (sign == 1) { //sottrai
                        
                        //rende il numero negativo
                        sum = Math.abs(sum);
                        sum = sum * -1;

                    } else if (sign == 2) { // somma
                        
                        //rende il numero positivo
                        sum = Math.abs(sum);

                    }
                    
                    //dati aggiornati
                    upData = dataIN.map (data => {
                        //dove gli id combaciano
                        if (data.id === id) {

                            if (operation === 1) { //add operation

                                data.sum += sum;

                            } else if (operation === 2) { //set operation

                                data.sum = sum;

                            }

                        }
                        return data;
                    })
                }
                
                //converte nuovamente il nuovo oggetto in Json
                let outJS = JSON.stringify(upData);
                
                //riscrive interamente il file Json con i nuovi dati
                fs.writeFile('data/data.json', outJS, (err) => { if (err) throw err; });
            });
    
            res.redirect('/dashboard');

        } else { //se inserito un input di modifica errato

            res.redirect('/dashboard?error=2&id=' + id);

        }
    
    } else { //se non autenticato

        res.redirect('/login');

    }
})

//avvio del app
app.listen(PORT, () => {
    console.log(`server sulla porta ${PORT}`);
  });