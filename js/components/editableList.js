import {loadData, saveData} from "../services/storage.service.js"
import { confirmDialog } from "../services/confirmDialog.js"
import { capitalizar } from "../utils/capitalize.js"

function formatearFechaCompletado(fechaISO){
    if (!fechaISO) return "";

    const d = new Date(fechaISO);
    if (Number.isNaN(d.getTime())) return "";

    const dia = String(d.getDate()).padStart(2, "0");
    const mes = capitalizar(d.toLocaleDateString("es-MX", { month: "short" }));

    return `${dia}/${mes}/${d.getFullYear()}`;
}

export function createEditableList({container, itemName, storageKey, onChange}){
    const list = container.querySelector(".editable-list__list")
    const input = container.querySelector(".editable-list__input")
    const addBtn = container.querySelector(".editable-list__add")
    const counter = container.querySelector(".editable-list__counter")

    let items  = loadData(storageKey);
    let editingId = null;

      function createLabel(data){
        const label = document.createElement("span");
        label.classList.add("editable-list__text");
        label.textContent = data.texto;
        label.title = "Doble clic para editar"
        return label;
    }
   
    function createEditField(data){
        const field = document.createElement("input");
        field.type = "text";
        field.classList.add("editable-list__edit");
        field.value = data.texto;
        field.setAttribute("aria-label", `Editar ${itemName}`);
        return field;
    }

    function createItemElement(data){
        const item = document.createElement("li");
        item.classList.add("editable-list__item");
        item.classList.toggle("editable-list__item--done", data.done);
        item.dataset.id = data.id;

        const check = document.createElement("input");
        check.type = "checkbox"
        check.classList.add("editable-list__check");
        check.checked = data.done;
        check.setAttribute("aria-label", `Marcar ${itemName} como completado`);

        const contentWrapper = document.createElement("div");
        contentWrapper.classList.add("editable-list__content");

        if (data.id === editingId) {

            contentWrapper.appendChild(createEditField(data));

        } else {

            contentWrapper.appendChild(createLabel(data));

            if (data.done && data.fechaCompletado) {

                const fecha = document.createElement("span");
                fecha.classList.add("editable-list__fecha-completado");
                fecha.textContent = `Completado: ${formatearFechaCompletado(data.fechaCompletado)}`;
                contentWrapper.appendChild(fecha);

            }

        }

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.classList.add("editable-list__delete");
        deleteBtn.textContent = "✕";
        deleteBtn.setAttribute("aria-label",`Eliminar ${itemName}`)

        item.append(check, contentWrapper, deleteBtn);
        return item;
    }

    function persist(){
        saveData(storageKey, items);
    }

    function renderCounter(){
        const total = items.length;
        const completados = items.filter((item)=> item.done).length
        counter.textContent = `${completados} de ${total} completados`
    }

    function notifyChange(){
        if (typeof onChange === "function") onChange(items);
    }

    function render(){
        const elements = items.map(createItemElement);
        list.replaceChildren(...elements); //los tres puntos hacen que cada elemento del arreglo sean un elemento único
       
       if(editingId !== null){
        const field = list.querySelector(".editable-list__edit")
            field.focus();
            field.select();
       }
         renderCounter();
         persist();
         notifyChange();
    }
    //total: cuantos items hay en el array. Los arrays tienen una propiedad que te da su tamaño
    //completados: cuantos tienen donde:true
  
    function addItem(texto){
        items.push({id: crypto.randomUUID(), texto, done: false});
        render()
    }
    async function removeItem(id) {
    const confirmado = await confirmDialog(
        "¿Estás seguro de eliminar? Tus datos relacionados a este objetivo en la sección de desarrollo se van a eliminar.",
        { danger: true }
    );

    if (!confirmado) return;

    items = items.filter((data) => data.id !== id);
    render();
    }

    function toggleItem(id){
        const data = items.find((item)=> item.id === id);
        data.done = !data.done;

        data.fechaCompletado =
            data.done
                ? new Date().toISOString()
                : null;

        render()
    }
//* FUNCIONES QUE VAN A EDITAR EL CONTENIDO

    function startEditing(id){
        editingId = id;
        render()
    }

    function commitEditing(nuevoTexto){
        if(editingId === null) return;

        const data = items.find((item) => item.id === editingId);
        const texto = nuevoTexto.trim();

        if(texto !== "") data.texto = texto;

        editingId = null
        render();
        
     }

     function cancelEditing(){
        editingId = null;
        render();
     }


    function handleAdd(){
        const texto = input.value.trim()

        if(texto === "") return;

        addItem(texto);
        input.value = "";
        input.focus();        
    }

    addBtn.addEventListener("click", handleAdd);

    input.addEventListener("keydown", (event)=>{
        if( event.key === "Enter") handleAdd();
    })

    //*
    list.addEventListener("click",(event)=>{
        const item = event.target.closest(".editable-list__item");

        if(!item)return;

        const id = item.dataset.id;

        if(event.target.matches(".editable-list__delete")){
            removeItem(id);
            return
        }
        if (event.target.matches(".editable-list__check")){
            toggleItem(id);
        }
        // if(event.target.matches(".editable-list__text")){
        //     toggleItem(id)
        // }

    })

    list.addEventListener("dblclick", (event)=>{
        console.log('doble clic detectado');
        if (!event.target.matches(".editable-list__text")) return;

        const item = event.target.closest(".editable-list__item");
        startEditing(item.dataset.id);
    })

    list.addEventListener("keydown", (event)=>{
        if (!event.target.matches(".editable-list__edit")) return;

        if(event.key === "Enter") commitEditing(event.target.value);
        if(event.key === "Escape")cancelEditing()
    })

    list.addEventListener("focusout", (event) =>{
        if(!event.target.matches(".editable-list__edit")) return;

        commitEditing(event.target.value);
    })

    render();
}