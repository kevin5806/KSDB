document.querySelectorAll('#editBtn').forEach(button => {
    button.addEventListener('click', event => {

        document.getElementById("e" + event.target.value).classList.remove("none");
  
    });
});

document.querySelectorAll('#editUN').forEach(button => {
    button.addEventListener('click', event => {

        document.getElementById("eIN" + event.target.value).value = ""
        document.getElementById("e" + event.target.value).classList.add("none");
  
    });
});

document.querySelectorAll('#menuBtn').forEach(button => {
    button.addEventListener('click', event => {

        if (event.target.value == true) {

            document.getElementById("menu").classList.add("none");
            document.getElementById("menuBtn").classList.remove("btn-s2");
            document.getElementById("menuBtn").value = 0;

        } else if (event.target.value == false) {

            document.getElementById("menu").classList.remove("none");
            document.getElementById("menuBtn").classList.add("btn-s2");
            document.getElementById("menuBtn").value = 1;

        }
  
    });
});

//controlla se EJS ha come ritorno un errore se è così apre il popup addData
if (document.getElementById("addDataSB").value == true) {

    document.getElementById("addData").classList.remove("none");
    document.getElementById("addDataBtn").classList.add("btn-add-o");
    document.getElementById("addDataBtn").value = 1;

}

document.querySelectorAll('#addDataBtn').forEach(button => {
    button.addEventListener('click', event => {

        if (event.target.value == true) {

            document.getElementById("addData").classList.add("none");
            document.getElementById("addDataBtn").classList.remove("btn-add-o");
            document.getElementById("addDataBtn").value = 0;

        } else if (event.target.value == false) {

            document.getElementById("addData").classList.remove("none");
            document.getElementById("addDataBtn").classList.add("btn-add-o");
            document.getElementById("addDataBtn").value = 1;

        }
  
    });
});

/*esegue il codice al suo interno se uno dei pulsanti SEND della sezione 
EDIT di un casella viene premuta ("event.target.value") = id della casella*/