if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(
      '/sw.js'
    );
}

let selected = 1;

document.querySelectorAll('#menuSelector > li').forEach(li => {
    li.addEventListener('click', event => {

        document.getElementById(selected).classList.remove('active');
        document.getElementById(li.id).classList.add('active');

        document.getElementById(`c${selected}`).classList.add('none');
        document.getElementById(`c${li.id}`).classList.remove('none');
        
        selected = li.id;
    })
})