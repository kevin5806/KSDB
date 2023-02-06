const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const uaParser = require('ua-parser-js')

//COSTANTI APP

//creazione dell app
const app = express();

//parametri del server
const PORT = process.env.PORT || 3000;

// ######### Impostazioni AppExpress ##############

//imposto la cartella e la engine di render
app.set('view engine', 'ejs');

// utilizzo delle librerie express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//serve per servire file statici accessibili da tutte le pagina del sito
const __static =  __dirname + '/public';

app.use(express.static(__static));

// ##################### Database ###########################

//url del database
const mongoURL = 'mongodb+srv://kevinserv:?Es2H3ca48nKbPeShVmYq@kevincluster.svejfwa.mongodb.net/KSbebt';

//rimuove un errore di mongoose nella versione attuale
mongoose.set('strictQuery', true);

// Connessione al database
mongoose.connect( mongoURL , {
  useNewUrlParser: true,
  useUnifiedTopology: true
})

// MODELLI

const ID = mongoose.model('id',
    new mongoose.Schema({
        id: {
            type: Number
        }
    })
)

const LOG = mongoose.model('log',
    new mongoose.Schema({
        client: {
            type: String
        },
        date: {
            type: String
        },
        ip: {
            type: String
        }
    })
)

const Data = mongoose.model('data',
    new mongoose.Schema({
        id: {
            type: Number,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        sum: {
            type: Number,
            required: true
        },
    })
)

// ################ Sessioni ######################

//funzione usata per creare una sessione
app.use(session({
    store: MongoStore.create({
        mongoUrl: mongoURL,
        touchAfter: 24 * 3600 *1 // indica il tempo massimo senza un utilizzo della sessione (in s)
    }),

    secret: '?Es(H+KbPeShVmYq', //chiave di criptazione per le sessioni
    
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 3, // indica la durata massima di un login (in ms)
        httpOnly: true
    }
}))

// ################################################


app.get('/', (req, res) => {

    res.sendFile(__static + '/index.html');

})

// route root di reindirizzamento all pagin principale
app.get('/dashboard', async (req, res) => {

    if (req.session.auth === true) { //verifica l'autenticazione
  
        const data = await Data.find().exec();
        const log = await LOG.find().exec();
  
        //error = 1 > campi di input vuoti
        //error = 2 > imput inserito nel edit non valido
        res.render('index', {array: data, log: log, error: req.query.error, errorID: req.query.id});
  
    } else { //se non autenticato
  
        res.redirect('/login');
  
    }
}) 

// route di redirect all pagina di login
app.get('/login', (req, res) => {

    //error = 1 > password/utente errati
    res.render('login', {error: req.query.error} );

})

app.post('/login', (req, res) => {

    //verifica se nome utente e password inviati dal front sono corretti
    if (req.body.user === "u" && req.body.pass === "p") {
        
        req.session.auth = true;
        req.session.ip = req.ip; // salva nei dati della sessione l'indirizzo IP del host
        
        new LOG({

            client: req.headers['user-agent'],
            date: new Date(),
            ip: req.ip
        
        }).save((err) => {
            if (err) return res.send(500, { error: err });

            //reinderizzamento alla pagina principale dove avverrà nuovamente il controllo sul autenticazione
            res.redirect('/dashboard');
        })

    
    } else {
        
        //reinderizza passando un errore
        res.redirect('/login?error=1');

    }
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

// route per l'aggiunta di nuovi dati
app.post('/data', (req, res) => {

    //verifica l'autenticazione
    if (req.session.auth === true) {

        let sum = Number(req.body.sum), name = req.body.name, sign = Number(req.body.sign);  
        
        // controlla se i campi di input sono vuoti o che non sia stata inserita una somma numerica
        if (typeof sum == "number" && !isNaN(sum) && name != "" && (sign == 1 || sign == 2)) {


            //Esegue le operzioni del menù di selezione positivo negativo nel front end
            if (sign == 1) { //sottrai
                    
                //rende il numero negativo
                sum = Math.abs(sum);
                sum = sum * -1;

            } else if (sign == 2) { // somma
                
                //rende il numero positivo
                sum = Math.abs(sum);

            }

            //fa in modo che l'id attuale venga aumentato di 1 sul database
            ID.findOneAndUpdate({}, { $inc: { id: 1 }}, (err) => { 
                if (err) return res.send(500, { error: err });
            })

            //legge l'auttuale valore di ID sul databse
            ID.findOne((err, ID) => {
                if (err) return res.send(500, { error: err });

                //Salva i nuovi dati sul database
                new Data({

                    id: ID.id,
                    name: name,
                    sum: sum

                }).save((err) => { 
                    if (err) return res.send(500, { error: err });

                    //reindirizzamento alla pagina principale
                    res.redirect('/dashboard');
                })

            })
        
        } else {
            //se i campi di input sono vuoti
            
            //reinderizza passando un errore
            res.redirect('/dashboard?error=1');

        }
        
    } else {
        //se l'user non è autenticato
        
        res.redirect('/login');
        
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

/*             Data.findOne({}, (err, data) => {
                if (err) return res.send(500, { error: err });
              
                // Modifica il valore del documento
                document.id += 1;
              
                // Salva il documento modificato
                document.save((err) => { 
                    if (err) return res.send(500, { error: err });
                });
            }) */


            if (sBtn == 2) { // form inviato con il pulsante delete

                Data.findOneAndRemove({ id: id }, (err) => {
                    if (err) return res.send(500, { error: err });
                    // deleted

                    //ritorna alla dashboard
                    res.redirect('/dashboard');
                })

            } else if (sBtn == 1) { // form inviato con il pulsante normale
                
                if (sign == 1) { //sottrai
                    
                    //rende il numero negativo
                    sum = Math.abs(sum);
                    sum = sum * -1;

                } else if (sign == 2) { // somma
                    
                    //rende il numero positivo
                    sum = Math.abs(sum);

                }

                Data.findOne({ id: id }, (err, data) => {
                    if (err) return res.send(500, { error: err });

                    // Modifica il valore del documento
                    if (operation === 1) { //add operation

                        data.sum += sum;

                    } else if (operation === 2) { //set operation

                        data.sum = sum;

                    }
                    
                    // Salva il documento modificato
                    data.save((err) => { 
                        if (err) return res.send(500, { error: err });

                        //ritorna alla dashboard
                        res.redirect('/dashboard');
                    })
                })
            }  

        } else { //se inserito un input di modifica errato

            res.redirect('/dashboard?error=2&id=' + id);

        }
    
    } else { //se non autenticato

        res.redirect('/login');

    }
})

//avvio del server
app.listen(PORT, () => {
    console.log(`server sulla porta ${PORT}`);
});
