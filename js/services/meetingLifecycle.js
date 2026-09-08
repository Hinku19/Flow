import {
    setReunionActivaId,
    getReunionActivaId
} from "./session.js";


import {
    saveData
} from "./storage.service.js";


import {
    showView
} from "./viewManager.js";


import {
    terminarReunion
} from "./meetingArchive.js";


import {
    confirmDialog
} from "./confirmDialog.js";


import {
    API_URL
} from "../components/config.js";


/* =========================================================
   OBTENER USUARIO DE SESIÓN
   ========================================================= */

function obtenerUsuarioSesion() {

    const usuarioGuardado =
        sessionStorage.getItem(
            "flow.usuario"
        );


    if (
        !usuarioGuardado
    ) {

        console.error(
            "No existe flow.usuario en sessionStorage."
        );

        return null;

    }


    try {

        const usuario =
            JSON.parse(
                usuarioGuardado
            );


        console.log(
            "USUARIO DE SESIÓN:",
            usuario
        );


        if (
            !usuario
        ) {

            return null;

        }


        /*
         * Normalizamos el ID por si
         * alguna versión anterior de login
         * utilizó otro nombre.
         */

        const id =
            usuario.id ??
            usuario.UserId ??
            usuario.UsuarioId;


        if (
            !id
        ) {

            console.error(
                "El usuario de sesión no contiene un ID:",
                usuario
            );

            return null;

        }


        return {

            ...usuario,

            id:
                Number(
                    id
                )

        };

    }
    catch (error) {

        console.error(
            "ERROR LEYENDO USUARIO DE SESIÓN:",
            error
        );


        return null;

    }

}


/* =========================================================
   INICIALIZAR CICLO DE VIDA
   ========================================================= */

export function initMeetingLifecycle({
    onStart,
    onPause,
    onResume,
    onEnd
}) {


    /* =====================================================
       ELEMENTOS PRINCIPALES
       ===================================================== */

    const btnIniciar =
        document.querySelector(
            "#btn-iniciar"
        );

    const btnProgramarHistorial =
    document.querySelector(
        "#btn-programar-reunion-historial"
    );

    const btnDashboardIniciar =
        document.querySelector(
            "#dashboard-iniciar-reunion"
        );


    const dialog =
        document.querySelector(
            ".start-dialog"
        );


    if (!dialog) {

        console.warn(
            "No se encontró .start-dialog"
        );

        return;

    }


    const form =
        dialog.querySelector(
            ".start-dialog__form"
        );


    const cancelBtn =
        dialog.querySelector(
            ".start-dialog__cancel"
        );


    const fechaInput =
        dialog.querySelector(
            "#input-fecha"
        );

    const tituloInput =
    dialog.querySelector(
        "#input-titulo"
    );

    const horaInput =
        dialog.querySelector(
            "#input-hora"
        );


    const duracionInput =
        dialog.querySelector(
            "#input-duracion"
        );


    const heredarCompromisosInput =
        dialog.querySelector(
            "#input-heredar-compromisos"
        );


    const btnPausar =
        document.querySelector(
            "#btn-pausar"
        );


    const btnTerminar =
        document.querySelector(
            "#btn-terminar"
        );


    const menuConfiguracion =
        document.querySelector(
            ".settings-menu"
        );


    const overlay =
        document.querySelector(
            "#pause-overlay"
        );


    /* =====================================================
       DEPARTAMENTO / ÁREA
       ===================================================== */

    const departamentoReunion =
        document.querySelector(
            "#reunion-departamento"
        );


    const areaReunion =
        document.querySelector(
            "#reunion-area"
        );


    /* =====================================================
       PARTICIPANTES
       ===================================================== */

    const usuariosDisponibles =
        document.querySelector(
            "#usuarios-disponibles"
        );


    const usuariosInvitados =
        document.querySelector(
            "#usuarios-invitados"
        );


    const btnAgregarParticipantes =
        document.querySelector(
            "#btn-agregar-participantes"
        );


    const btnQuitarParticipantes =
        document.querySelector(
            "#btn-quitar-participantes"
        );


    const avisoParticipantes =
        document.querySelector(
            "#aviso-participantes"
        );


    /* =====================================================
       VALIDACIONES DE ELEMENTOS
       ===================================================== */

    if (!form) {

        console.warn(
            "No se encontró .start-dialog__form"
        );

        return;

    }


    if (!fechaInput) {

        console.warn(
            "No se encontró #input-fecha"
        );

        return;

    }


    if (!horaInput) {

        console.warn(
            "No se encontró #input-hora"
        );

        return;

    }


    /* =====================================================
       ESTADO
       ===================================================== */

    let participantes = [];


    let usuarios = [];


    let usuariosDisponiblesActuales = [];


    let usuariosInvitadosActuales = [];


    let pausada = false;


    /*
     * Evita que un doble clic (o una reunión que tarda en
     * procesar) dispare terminar() dos veces y duplique los
     * compromisos migrados a la tabla permanente.
     */
    let terminandoReunion = false;


    /* =========================================================
       CARGAR USUARIOS
       ========================================================= */

    async function cargarUsuarios() {

        if (!usuariosDisponibles) {
            return;
        }


        try {

            const response =
                await fetch(
                    `${API_URL}/usuarios`
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible obtener los usuarios."
                );

            }


            usuarios =
                (data.usuarios || [])
                    .filter(
                        usuario =>
                            Number(
                                usuario.activo
                            ) === 1
                    );


            renderUsuariosDisponibles();


        }
        catch (error) {

            console.error(
                "Error cargando usuarios:",
                error
            );


            usuariosDisponibles.innerHTML = `
                <div class="meeting-participants__empty">
                    No fue posible cargar los usuarios.
                </div>
            `;


            if (btnAgregarParticipantes) {

                btnAgregarParticipantes.disabled =
                    true;

            }

        }

    }


    /* =========================================================
       CARGAR DEPARTAMENTOS
       ========================================================= */

    async function cargarDepartamentosReunion() {

        if (!departamentoReunion) {
            return;
        }


        try {

            const response =
                await fetch(
                    `${API_URL}/subsidiaries`
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible cargar los departamentos."
                );

            }


            departamentoReunion.innerHTML = `
                <option value="">
                    Seleccione un departamento
                </option>
            `;


            (data.datos || [])
                .forEach(
                    departamento => {

                        const option =
                            document.createElement(
                                "option"
                            );


                        option.value =
                            departamento.SubsidiaryId;


                        option.textContent =
                            departamento.SubsidiaryName;


                        departamentoReunion.appendChild(
                            option
                        );

                    }
                );


        }
        catch (error) {

            console.error(
                "Error cargando departamentos:",
                error
            );


            departamentoReunion.innerHTML = `
                <option value="">
                    Error al cargar departamentos
                </option>
            `;

        }

    }


    /* =========================================================
       CARGAR ÁREAS
       ========================================================= */

    async function cargarAreasReunion(
        subsidiaryId
    ) {

        if (!areaReunion) {
            return;
        }


        areaReunion.disabled =
            true;


        areaReunion.innerHTML = `
            <option value="">
                Cargando áreas...
            </option>
        `;


        if (!subsidiaryId) {

            areaReunion.innerHTML = `
                <option value="">
                    Seleccione primero un departamento
                </option>
            `;


            renderUsuariosDisponibles();

            return;

        }


        try {

            const response =
                await fetch(
                    `${API_URL}/areas?subsidiaryId=${encodeURIComponent(
                        subsidiaryId
                    )}`
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible cargar las áreas."
                );

            }


            const areas =
                data.datos || [];


            areaReunion.innerHTML = `
                <option value="">
                    Seleccione un área
                </option>
            `;


            areas.forEach(
                area => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        area.AreaId;


                    option.textContent =
                        area.AreaName;


                    areaReunion.appendChild(
                        option
                    );

                }
            );


            areaReunion.disabled =
                areas.length === 0;


            if (
                areas.length === 0
            ) {

                areaReunion.innerHTML = `
                    <option value="">
                        No hay áreas disponibles
                    </option>
                `;

            }


            renderUsuariosDisponibles();


        }
        catch (error) {

            console.error(
                "Error cargando áreas:",
                error
            );


            areaReunion.innerHTML = `
                <option value="">
                    Error al cargar áreas
                </option>
            `;


            areaReunion.disabled =
                true;


            renderUsuariosDisponibles();

        }

    }


    /* =========================================================
       OBTENER USUARIOS FILTRADOS
       ========================================================= */

    function obtenerUsuariosFiltrados() {

        if (
            !departamentoReunion ||
            !areaReunion
        ) {

            return [];

        }


        if (
            !departamentoReunion.value ||
            !areaReunion.value
        ) {

            return [];

        }


        const departamentoTexto =
            departamentoReunion
                .options[
                    departamentoReunion.selectedIndex
                ]?.text || "";


        const areaTexto =
            areaReunion
                .options[
                    areaReunion.selectedIndex
                ]?.text || "";


        return usuarios.filter(
            usuario => {

                const usuarioDepartamento =
                    String(
                        usuario.departamento ||
                        ""
                    )
                        .trim()
                        .toLowerCase();


                const usuarioArea =
                    String(
                        usuario.area ||
                        ""
                    )
                        .trim()
                        .toLowerCase();


                const departamentoSeleccionado =
                    departamentoTexto
                        .trim()
                        .toLowerCase();


                const areaSeleccionada =
                    areaTexto
                        .trim()
                        .toLowerCase();


                return (
                    usuarioDepartamento ===
                        departamentoSeleccionado
                    &&
                    usuarioArea ===
                        areaSeleccionada
                );

            }
        );

    }


    /* =========================================================
       MOSTRAR USUARIOS DISPONIBLES
       ========================================================= */

    function renderUsuariosDisponibles() {

        if (!usuariosDisponibles) {
            return;
        }


        const filtrados =
            obtenerUsuariosFiltrados();


        usuariosDisponiblesActuales =
            filtrados;


        const disponibles =
            filtrados.filter(
                usuario =>
                    !usuariosInvitadosActuales.some(
                        invitado =>
                            Number(
                                invitado.id
                            ) ===
                            Number(
                                usuario.id
                            )
                    )
            );


        usuariosDisponibles.innerHTML =
            "";


        if (
            disponibles.length === 0
        ) {

            usuariosDisponibles.innerHTML = `
                <div class="meeting-participants__empty">
                    No hay usuarios disponibles.
                </div>
            `;


            actualizarBotonesParticipantes();

            return;

        }


        disponibles.forEach(
            usuario => {

                const elemento =
                    crearElementoUsuario(
                        usuario,
                        "disponible"
                    );


                usuariosDisponibles.appendChild(
                    elemento
                );

            }
        );


        actualizarBotonesParticipantes();

    }


    /* =========================================================
       MOSTRAR USUARIOS INVITADOS
       ========================================================= */

    function renderUsuariosInvitados() {

        if (!usuariosInvitados) {
            return;
        }


        usuariosInvitados.innerHTML =
            "";


        if (
            usuariosInvitadosActuales.length ===
            0
        ) {

            usuariosInvitados.innerHTML = `
                <div
                    class="meeting-participants__empty"
                    id="invitados-empty"
                >
                    No hay invitados seleccionados.
                </div>
            `;


            actualizarBotonesParticipantes();

            return;

        }


        usuariosInvitadosActuales.forEach(
            usuario => {

                const elemento =
                    crearElementoUsuario(
                        usuario,
                        "invitado"
                    );


                usuariosInvitados.appendChild(
                    elemento
                );

            }
        );


        actualizarBotonesParticipantes();

    }


    /* =========================================================
       CREAR ELEMENTO DE USUARIO
       ========================================================= */

    function crearElementoUsuario(
        usuario,
        tipo
    ) {

        const label =
            document.createElement(
                "label"
            );


        label.className =
            "meeting-participant";


        const checkbox =
            document.createElement(
                "input"
            );


        checkbox.type =
            "checkbox";


        checkbox.value =
            usuario.id;


        checkbox.dataset.tipo =
            tipo;


        const info =
            document.createElement(
                "span"
            );


        info.className =
            "meeting-participant__info";


        const nombre =
            document.createElement(
                "span"
            );


        nombre.className =
            "meeting-participant__name";


        nombre.textContent =
            usuario.nombre || "";


        const correo =
            document.createElement(
                "span"
            );


        correo.className =
            "meeting-participant__email";


        correo.textContent =
            usuario.correo_electronico ||
            "";


        info.appendChild(
            nombre
        );


        info.appendChild(
            correo
        );


        label.appendChild(
            checkbox
        );


        label.appendChild(
            info
        );


        return label;

    }


    /* =========================================================
       AGREGAR PARTICIPANTES
       ========================================================= */

    function agregarParticipantes() {

        if (!usuariosDisponibles) {
            return;
        }


        const seleccionados =
            usuariosDisponibles.querySelectorAll(
                'input[type="checkbox"]:checked'
            );


        seleccionados.forEach(
            checkbox => {

                const usuario =
                    usuarios.find(
                        item =>
                            Number(
                                item.id
                            ) ===
                            Number(
                                checkbox.value
                            )
                    );


                if (!usuario) {
                    return;
                }


                const existe =
                    usuariosInvitadosActuales.some(
                        invitado =>
                            Number(
                                invitado.id
                            ) ===
                            Number(
                                usuario.id
                            )
                    );


                if (!existe) {

                    usuariosInvitadosActuales.push(
                        usuario
                    );

                }

            }
        );


        actualizarParticipantes();


        renderUsuariosDisponibles();


        renderUsuariosInvitados();

    }


    /* =========================================================
       QUITAR PARTICIPANTES
       ========================================================= */

    function quitarParticipantes() {

        if (!usuariosInvitados) {
            return;
        }


        const seleccionados =
            usuariosInvitados.querySelectorAll(
                'input[type="checkbox"]:checked'
            );


        const ids =
            Array.from(
                seleccionados
            ).map(
                checkbox =>
                    Number(
                        checkbox.value
                    )
            );


        usuariosInvitadosActuales =
            usuariosInvitadosActuales.filter(
                usuario =>
                    !ids.includes(
                        Number(
                            usuario.id
                        )
                    )
            );


        actualizarParticipantes();


        renderUsuariosDisponibles();


        renderUsuariosInvitados();

    }


    /* =========================================================
       ACTUALIZAR BOTONES DE PARTICIPANTES
       ========================================================= */

    function actualizarBotonesParticipantes() {

        const disponiblesSeleccionados =
            usuariosDisponibles
                ? usuariosDisponibles.querySelectorAll(
                    'input[type="checkbox"]:checked'
                ).length
                : 0;


        const invitadosSeleccionados =
            usuariosInvitados
                ? usuariosInvitados.querySelectorAll(
                    'input[type="checkbox"]:checked'
                ).length
                : 0;


        if (
            btnAgregarParticipantes
        ) {

            btnAgregarParticipantes.disabled =
                disponiblesSeleccionados === 0;

        }


        if (
            btnQuitarParticipantes
        ) {

            btnQuitarParticipantes.disabled =
                invitadosSeleccionados === 0;

        }


        actualizarBotonProgramar();

    }


    /* =========================================================
       ACTUALIZAR PARTICIPANTES
       ========================================================= */

    function actualizarParticipantes() {

        participantes =
            usuariosInvitadosActuales.map(
                usuario =>
                    usuario.nombre
            );


        actualizarBotonProgramar();

    }


    /* =========================================================
       ACTUALIZAR BOTÓN PROGRAMAR
       ========================================================= */

    function actualizarBotonProgramar() {

        const confirmBtn =
            dialog.querySelector(
                ".start-dialog__confirm"
            );


        if (!confirmBtn) {
            return;
        }


        const faltanParticipantes =
            usuariosInvitadosActuales.length <
            2;


        confirmBtn.disabled =
            faltanParticipantes;


        if (avisoParticipantes) {

            avisoParticipantes.classList.toggle(
                "start-dialog__aviso--visible",
                faltanParticipantes
            );

        }

    }


    /* =========================================================
       FECHA LOCAL
       ========================================================= */

    function obtenerFechaLocal() {

        const ahora =
            new Date();


        const year =
            ahora.getFullYear();


        const month =
            String(
                ahora.getMonth() + 1
            ).padStart(
                2,
                "0"
            );


        const day =
            String(
                ahora.getDate()
            ).padStart(
                2,
                "0"
            );


        return (
            `${year}-${month}-${day}`
        );

    }


    /* =========================================================
       HORA REDONDEADA
       ========================================================= */

    function obtenerHoraRedondeada() {

        const ahora =
            new Date();


        let hours =
            ahora.getHours();


        let minutes =
            ahora.getMinutes();


        minutes =
            Math.ceil(
                minutes / 5
            ) * 5;


        if (
            minutes === 60
        ) {

            minutes =
                0;

            hours++;

        }


        if (
            hours >= 24
        ) {

            hours =
                0;

        }


        return (
            `${String(
                hours
            ).padStart(2, "0")}:` +
            `${String(
                minutes
            ).padStart(2, "0")}`
        );

    }


    /* =========================================================
       ABRIR DIALOG
       ========================================================= */

    function openDialog() {

        participantes =
            [];


        usuariosInvitadosActuales =
            [];


        usuariosDisponiblesActuales =
            [];

            if (
        tituloInput
    ) {

        tituloInput.value =
            "";

    }


        if (duracionInput) {

            duracionInput.value =
                "60";

        }


        if (heredarCompromisosInput) {

            heredarCompromisosInput.checked =
                true;

        }


        if (
            departamentoReunion
        ) {

            departamentoReunion.value =
                "";

        }


        if (
            areaReunion
        ) {

            areaReunion.innerHTML = `
                <option value="">
                    Seleccione primero un departamento
                </option>
            `;


            areaReunion.disabled =
                true;

        }


        renderUsuariosDisponibles();


        renderUsuariosInvitados();


        actualizarBotonProgramar();


        cargarDepartamentosReunion();


        cargarUsuarios();


        const ahora =
            new Date();


        let fechaInicial =
            obtenerFechaLocal();


        let horaInicial =
            obtenerHoraRedondeada();


        /*
         * Si el redondeo pasa al día siguiente.
         */

        if (
            ahora.getHours() === 23 &&
            ahora.getMinutes() >= 56
        ) {

            const manana =
                new Date(
                    ahora
                );


            manana.setDate(
                manana.getDate() + 1
            );


            const year =
                manana.getFullYear();


            const month =
                String(
                    manana.getMonth() + 1
                ).padStart(
                    2,
                    "0"
                );


            const day =
                String(
                    manana.getDate()
                ).padStart(
                    2,
                    "0"
                );


            fechaInicial =
                `${year}-${month}-${day}`;


            horaInicial =
                "00:00";

        }


        fechaInput.min =
            obtenerFechaLocal();


        fechaInput.value =
            fechaInicial;


        horaInput.value =
            horaInicial;


        actualizarHoraMinima();


        if (
            typeof dialog.showModal ===
            "function"
        ) {

            dialog.showModal();

        }
        else {

            dialog.setAttribute(
                "open",
                ""
            );

        }

    }


    /* =========================================================
       ACTUALIZAR HORA MÍNIMA
       ========================================================= */

    function actualizarHoraMinima() {

        const hoy =
            obtenerFechaLocal();


        if (
            fechaInput.value !==
            hoy
        ) {

            horaInput.removeAttribute(
                "min"
            );

            return;

        }


        const ahora =
            new Date();


        let hours =
            ahora.getHours();


        let minutes =
            ahora.getMinutes();


        minutes =
            Math.ceil(
                minutes / 5
            ) * 5;


        if (
            minutes === 60
        ) {

            minutes =
                0;

            hours++;

        }


        if (
            hours >= 24
        ) {

            horaInput.removeAttribute(
                "min"
            );

            return;

        }


        const horaMinima =
            `${String(
                hours
            ).padStart(2, "0")}:` +
            `${String(
                minutes
            ).padStart(2, "0")}`;


        horaInput.min =
            horaMinima;


        if (
            horaInput.value &&
            horaInput.value <
                horaMinima
        ) {

            horaInput.value =
                horaMinima;

        }

    }


    /* =========================================================
       CERRAR DIALOG
       ========================================================= */

    function closeDialog() {

        if (
            typeof dialog.close ===
            "function"
        ) {

            dialog.close();

        }
        else {

            dialog.removeAttribute(
                "open"
            );

        }

    }


    /* =========================================================
       BOTONES DE REUNIÓN ACTIVA
       ========================================================= */

    function setBotonesReunionActiva(
        activa
    ) {

        if (
            btnIniciar
        ) {

            btnIniciar.disabled =
                activa;

        }


        if (
            btnPausar
        ) {

            btnPausar.disabled =
                !activa;

            btnPausar.hidden =
                !activa;

        }


        if (
            btnTerminar
        ) {

            btnTerminar.disabled =
                !activa;

            btnTerminar.hidden =
                !activa;

        }


        if (
            menuConfiguracion
        ) {

            menuConfiguracion.hidden =
                activa;

        }

    }

    /* =========================================================
   CONVERTIR DATE A DATETIME MYSQL
   ========================================================= */

function convertirAFechaMySQL(
    fecha
) {

    const pad =
        valor =>
            String(valor)
                .padStart(
                    2,
                    "0"
                );


    const year =
        fecha.getFullYear();

    const month =
        pad(
            fecha.getMonth() + 1
        );

    const day =
        pad(
            fecha.getDate()
        );

    const hours =
        pad(
            fecha.getHours()
        );

    const minutes =
        pad(
            fecha.getMinutes()
        );

    const seconds =
        pad(
            fecha.getSeconds()
        );


    return (
        `${year}-${month}-${day} ` +
        `${hours}:${minutes}:${seconds}`
    );

}

/* =========================================================
   CREAR REUNIÓN EN BD
   ========================================================= */

async function crearReunionBD(
    titulo,
    fechaInicio,
    duracion,
    usuarioCreadorId,
    heredarCompromisos
) {

    const fechaInicioObj =
        new Date(
            fechaInicio
        );


    const fechaFinObj =
        new Date(
            fechaInicioObj.getTime() +
            (
                duracion *
                60 *
                1000
            )
        );


    const fechaInicioMySQL =
        convertirAFechaMySQL(
            fechaInicioObj
        );


    const fechaFinMySQL =
        convertirAFechaMySQL(
            fechaFinObj
        );


    const tituloLimpio =
        String(
            titulo ||
            ""
        ).trim();


    if (
        !tituloLimpio
    ) {

        throw new Error(
            "El título de la reunión es obligatorio."
        );

    }


    console.log(
        "DATOS QUE SE ENVIARÁN A /api/reuniones:",
        {
            titulo:
                tituloLimpio,

            fechaInicio:
                fechaInicioMySQL,

            fechaFin:
                fechaFinMySQL,

            usuarioCreadorId:
                usuarioCreadorId,

            tipoUsuarioCreadorId:
                typeof usuarioCreadorId
        }
    );


    const response =
        await fetch(
            `${API_URL}/reuniones`,
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        titulo:
                            tituloLimpio,

                        descripcion:
                            null,

                        fechaInicio:
                            fechaInicioMySQL,

                        fechaFin:
                            fechaFinMySQL,

                        lugar:
                            null,

                        estado:
                            "Programada",

                        usuarioCreadorId:
                            Number(
                                usuarioCreadorId
                            ),

                        heredarCompromisos:
                            Boolean(
                                heredarCompromisos
                            )

                    })

            }
        );


    const data =
        await response.json();


    if (
        !response.ok
    ) {

        throw new Error(
            data.mensaje ||
            data.error ||
            "No fue posible crear la reunión."
        );

    }


    if (
        !data.ReunionId
    ) {

        throw new Error(
            "El servidor no devolvió el ID de la reunión."
        );

    }


    return data.ReunionId;

}




    /* =========================================================
       PROGRAMAR REUNIÓN
       ========================================================= */

    async function programarReunion() {

        if (
            usuariosInvitadosActuales.length <
            2
        ) {

            alert(
                "Debes seleccionar al menos dos participantes."
            );

            return;

        }


        const fecha =
            fechaInput.value;

            const titulo =
    tituloInput
        ? tituloInput.value.trim()
        : "";


        const hora =
            horaInput.value;


            if (
    !titulo
) {

    alert(
        "Debes indicar el título de la reunión."
    );

    if (
        tituloInput
    ) {

        tituloInput.focus();

    }

    return;

}

        if (
            !fecha ||
            !hora
        ) {

            alert(
                "Debes seleccionar la fecha y hora de la reunión."
            );

            return;

        }


        const fechaProgramada =
            new Date(
                `${fecha}T${hora}:00`
            );


        if (
            Number.isNaN(
                fechaProgramada.getTime()
            )
        ) {

            alert(
                "La fecha u hora de la reunión no es válida."
            );

            return;

        }


        if (
            fechaProgramada <=
            new Date()
        ) {

            alert(
                "La fecha y hora de la reunión deben ser posteriores al momento actual."
            );


            actualizarHoraMinima();


            return;

        }


/* =====================================================
   USUARIO ACTUAL
   ===================================================== */

const usuarioSesion =
    obtenerUsuarioSesion();


if (!usuarioSesion) {

    alert(
        "No se encontró la sesión del usuario."
    );

    return;

}


if (!usuarioSesion.id) {

    alert(
        "La sesión del usuario no contiene un ID válido."
    );

    return;

}


/* =====================================================
   DURACIÓN
   ===================================================== */

const duracion =
    duracionInput
        ? Number(
            duracionInput.value
        )
        : 60;


/* =====================================================
   CREAR REUNIÓN EN MYSQL
   ===================================================== */

console.log(
    "DATOS PARA CREAR REUNIÓN:",
    {
        titulo:
            titulo,

        fechaInicio:
            fechaProgramada,

        duracion:
            duracion,

        usuarioCreadorId:
            usuarioSesion.id
    }
);


let reunionId;


try {

    reunionId =
        await crearReunionBD(
            titulo,
            fechaProgramada,
            duracion,
            usuarioSesion.id,
            heredarCompromisosInput
                ? heredarCompromisosInput.checked
                : true
        );

}
catch (error) {

    console.error(
        "ERROR CREANDO REUNIÓN:",
        error
    );


    alert(
        error.message ||
        "No fue posible crear la reunión."
    );


    return;

}


/* =====================================================
   GUARDAR REUNIÓN ACTIVA
   ===================================================== */

setReunionActivaId(
    reunionId
);

try {

    await guardarParticipantesBD(
        reunionId,
        usuariosInvitadosActuales
    );

}
catch (error) {

    console.error(
        "ERROR GUARDANDO PARTICIPANTES:",
        error
    );


    alert(
        error.message ||
        "La reunión se creó, pero no fue posible guardar los participantes."
    );

    return;

}


        closeDialog();


        document.dispatchEvent(
            new CustomEvent(
                "flow:reunion-programada"
            )
        );

    }

    /* =========================================================
   GUARDAR PARTICIPANTES EN BD
   ========================================================= */

async function guardarParticipantesBD(
    reunionId,
    usuariosSeleccionados
) {

    const response =
        await fetch(
            `${API_URL}/reuniones/${reunionId}/participantes`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({

                        usuarios:
                            usuariosSeleccionados.map(
                                usuario =>
                                    Number(
                                        usuario.id
                                    )
                            )

                    })
            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.mensaje ||
            data.error ||
            "No fue posible guardar los participantes."
        );

    }


    return data;

}


/* =========================================================
   INICIAR REUNIÓN PROGRAMADA
   ========================================================= */

async function iniciarReunionProgramada(
    id
) {

    try {

        const reunionId =
            Number(
                id
            );


        /* =====================================================
           VALIDAR ID
           ===================================================== */

        if (!reunionId) {

            console.error(
                "ID de reunión no válido:",
                id
            );

            return;

        }


        /* =====================================================
           OBTENER REUNIÓN DESDE MYSQL
           ===================================================== */

        const response =
            await fetch(
                `${API_URL}/reuniones/${reunionId}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.mensaje ||
                data.error ||
                "No fue posible obtener la reunión."
            );

        }


        if (
            !data.reunion
        ) {

            throw new Error(
                "La API no devolvió información de la reunión."
            );

        }


        /* =====================================================
           CONFIRMAR
           ===================================================== */

        const confirmado =
            await confirmDialog(
                data.reunion.Estado === "En curso"
                    ? "¿Deseas continuar esta reunión?"
                    : "¿Deseas iniciar esta reunión?"
            );


        if (
            !confirmado
        ) {

            return;

        }


        /* =====================================================
           CONSTRUIR OBJETO COMPATIBLE CON FLOW
           ===================================================== */

        const participantes =
            data.participantes ||
            [];


        const reunion = {

            id:
                Number(
                    data.reunion.ReunionId
                ),

            titulo:
                data.reunion.Titulo ||
                "Reunión Flow",

            descripcion:
                data.reunion.Descripcion ||
                "",

            fecha:
                data.reunion.FechaInicio,

            fechaInicio:
                new Date().toISOString(),

            fechaFin:
                data.reunion.FechaFin,

            lugar:
                data.reunion.Lugar ||
                "",

            estado:
                "en-curso",

            usuarioCreadorId:
                data.reunion.UsuarioCreadorId,

            /*
             * Nombres de los participantes.
             */

            participantes:
                participantes.map(
                    participante =>
                        participante.nombre
                ),

            /*
             * IDs de participantes.
             */

            participanteIds:
                participantes.map(
                    participante =>
                        Number(
                            participante.UsuarioId
                        )
                ),

            /*
             * Duración calculada
             * a partir de Inicio/Fin.
             */

            duracion:
                calcularDuracionReunion(
                    data.reunion.FechaInicio,
                    data.reunion.FechaFin
                )

        };


        console.log(
            "REUNIÓN OBTENIDA DESDE MYSQL:",
            reunion
        );


        /* =====================================================
           ACTUALIZAR ESTADO EN MYSQL
           ===================================================== */

        await actualizarEstadoReunionBD(
            reunionId,
            "En curso"
        );


        /* =====================================================
           GUARDAR META TEMPORAL
           ===================================================== */

        saveData(
            `flow.reunion.${reunionId}.meta`,
            reunion
        );


        /* =====================================================
           REUNIÓN ACTIVA
           ===================================================== */

        pausada =
            false;

        terminandoReunion =
            false;


        if (
            btnPausar
        ) {

            btnPausar.textContent =
                "Pausar";

        }


        setReunionActivaId(
            reunionId
        );


        /* =====================================================
           HEREDAR PENDIENTES
           ===================================================== */

        /*
         * Se calcula y se guarda en el servidor (no en
         * localStorage) para que funcione sin importar en qué
         * computadora se programó, finalizó o inició cada
         * reunión.
         */

        try {

            await fetch(
                `${API_URL}/reuniones/${reunionId}/heredar-pendientes`,
                {

                    method:
                        "POST"

                }
            );

        }
        catch (error) {

            console.error(
                "ERROR HEREDANDO PENDIENTES:",
                error
            );

            /*
             * No detenemos la reunión: si esto falla, la
             * reunión simplemente arranca sin heredar nada.
             */

        }


        /* =====================================================
           ABRIR REUNIÓN
           ===================================================== */

        showView(
            "reunion"
        );


        setBotonesReunionActiva(
            true
        );


        /* =====================================================
           ON START
           ===================================================== */

        if (
            typeof onStart ===
            "function"
        ) {

            await onStart(
                reunion
            );

        }

    }
    catch (error) {

        console.error(
            "ERROR AL INICIAR REUNIÓN:",
            error
        );


        alert(
            error.message ||
            "No fue posible iniciar la reunión."
        );

    }

}

/* =========================================================
   CALCULAR DURACIÓN DE REUNIÓN
   ========================================================= */

function calcularDuracionReunion(
    fechaInicio,
    fechaFin
) {

    if (
        !fechaInicio ||
        !fechaFin
    ) {

        return 60;

    }


    const inicio =
        new Date(
            fechaInicio
        );


    const fin =
        new Date(
            fechaFin
        );


    const diferencia =
        fin.getTime() -
        inicio.getTime();


    const minutos =
        Math.round(
            diferencia /
            (1000 * 60)
        );


    return minutos > 0
        ? minutos
        : 60;

}

/* =========================================================
   ACTUALIZAR ESTADO DE REUNIÓN EN MYSQL
   ========================================================= */

async function actualizarEstadoReunionBD(
    reunionId,
    estado
) {

    const response =
        await fetch(
            `${API_URL}/reuniones/${reunionId}/estado`,
            {

                method:
                    "PATCH",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        estado:
                            estado

                    })

            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.mensaje ||
            data.error ||
            "No fue posible actualizar el estado de la reunión."
        );

    }


    return data;

}

/* =========================================================
   ACTUALIZAR ESTADO DE REUNIÓN
   ========================================================= */

async function actualizarEstadoReunionBD(
    reunionId,
    estado
) {

    const response =
        await fetch(
            `${API_URL}/reuniones/${reunionId}/estado`,
            {

                method:
                    "PATCH",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        estado:
                            estado

                    })

            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.mensaje ||
            data.error ||
            "No fue posible actualizar el estado de la reunión."
        );

    }


    return data;

}


    /* =========================================================
       TERMINAR REUNIÓN
       ========================================================= */

    async function terminar() {

        if (
            terminandoReunion
        ) {

            return;

        }


        const confirmado =
            await confirmDialog(
                "¿Seguro que quieres terminar la reunión? Se guardará en el historial y no podrás editarla."
            );


        if (
            !confirmado
        ) {

            return;

        }


        if (
            terminandoReunion
        ) {

            return;

        }

        terminandoReunion =
            true;


        const reunionId =
    Number(
        getReunionActivaId()
    );


if (!reunionId) {

    console.error(
        "No existe una reunión activa."
    );

    terminandoReunion =
        false;

    return;

}


try {

    await actualizarEstadoReunionBD(
        reunionId,
        "Finalizada"
    );

}
catch (error) {

    console.error(
        "ERROR ACTUALIZANDO ESTADO EN MYSQL:",
        error
    );


    alert(
        error.message ||
        "No fue posible finalizar la reunión."
    );


    terminandoReunion =
        false;

    return;

}


/*
 * Mantener temporalmente
 * el comportamiento anterior.
 */
terminarReunion();


        if (
            overlay
        ) {

            overlay.classList.remove(
                "pause-overlay--visible"
            );

        }


        pausada =
            false;


        setBotonesReunionActiva(
            false
        );


        if (
            btnPausar
        ) {

            btnPausar.textContent =
                "Pausar";

        }


        showView(
            "historial"
        );


        if (
            typeof onEnd ===
            "function"
        ) {

            onEnd();

        }

    }


    /* =========================================================
       ACTUALIZAR BADGE
       ========================================================= */

    function actualizarBadgeEstado(
        texto,
        clase
    ) {

        const estadoEl =
            document.querySelector(
                '[data-campo="estado"]'
            );


        if (!estadoEl) {
            return;
        }


        estadoEl.innerHTML =
            "";


        const badge =
            document.createElement(
                "span"
            );


        badge.classList.add(
            "status-badge",
            clase
        );


        badge.textContent =
            texto;


        estadoEl.appendChild(
            badge
        );

    }


    /* =========================================================
       PAUSAR
       ========================================================= */

    function pausar() {

        pausada =
            true;


        if (
            overlay
        ) {

            overlay.classList.add(
                "pause-overlay--visible"
            );

        }


        if (
            btnPausar
        ) {

            btnPausar.textContent =
                "Reanudar";

        }


        actualizarBadgeEstado(
            "● Pausada",
            "status-badge--pausada"
        );


        if (
            typeof onPause ===
            "function"
        ) {

            onPause();

        }

    }


    /* =========================================================
       REANUDAR
       ========================================================= */

    function reanudar() {

        pausada =
            false;


        if (
            overlay
        ) {

            overlay.classList.remove(
                "pause-overlay--visible"
            );

        }


        if (
            btnPausar
        ) {

            btnPausar.textContent =
                "Pausar";

        }


        actualizarBadgeEstado(
            "● En curso",
            "status-badge--en-curso"
        );


        if (
            typeof onResume ===
            "function"
        ) {

            onResume();

        }

    }


    /* =========================================================
       TOGGLE PAUSA
       ========================================================= */

    function togglePausa() {

        if (
            pausada
        ) {

            reanudar();

        }
        else {

            pausar();

        }

    }


    /* =========================================================
       EVENTOS - DASHBOARD
       ========================================================= */

    if (
        btnDashboardIniciar
    ) {

        btnDashboardIniciar.addEventListener(
            "click",
            openDialog
        );

    }


    /* =========================================================
       EVENTOS - HEADER
       ========================================================= */

    if (
        btnIniciar
    ) {

        btnIniciar.addEventListener(
            "click",
            openDialog
        );

    }

    if (
        btnProgramarHistorial
    ) {

            btnProgramarHistorial.addEventListener(
            "click",
            openDialog
        );

    }


    /* =========================================================
       EVENTO - CANCELAR
       ========================================================= */

    if (
        cancelBtn
    ) {

        cancelBtn.addEventListener(
            "click",
            closeDialog
        );

    }


    /* =========================================================
       EVENTO - FECHA
       ========================================================= */

    fechaInput.addEventListener(
        "change",
        actualizarHoraMinima
    );


    /* =========================================================
       EVENTO - DEPARTAMENTO
       ========================================================= */

    if (
        departamentoReunion
    ) {

        departamentoReunion.addEventListener(
            "change",
            () => {

                cargarAreasReunion(
                    departamentoReunion.value
                );

            }
        );

    }


    /* =========================================================
       EVENTO - ÁREA
       ========================================================= */

    if (
        areaReunion
    ) {

        areaReunion.addEventListener(
            "change",
            () => {

                renderUsuariosDisponibles();

            }
        );

    }


    /* =========================================================
       EVENTO - AGREGAR PARTICIPANTES
       ========================================================= */

    if (
        btnAgregarParticipantes
    ) {

        btnAgregarParticipantes.addEventListener(
            "click",
            agregarParticipantes
        );

    }


    /* =========================================================
       EVENTO - QUITAR PARTICIPANTES
       ========================================================= */

    if (
        btnQuitarParticipantes
    ) {

        btnQuitarParticipantes.addEventListener(
            "click",
            quitarParticipantes
        );

    }


    /* =========================================================
       EVENTO - CHECKBOX DISPONIBLES
       ========================================================= */

    if (
        usuariosDisponibles
    ) {

        usuariosDisponibles.addEventListener(
            "change",
            actualizarBotonesParticipantes
        );

    }


    /* =========================================================
       EVENTO - CHECKBOX INVITADOS
       ========================================================= */

    if (
        usuariosInvitados
    ) {

        usuariosInvitados.addEventListener(
            "change",
            actualizarBotonesParticipantes
        );

    }


    /* =========================================================
       EVENTO - PAUSAR / REANUDAR
       ========================================================= */

    if (
        btnPausar
    ) {

        btnPausar.addEventListener(
            "click",
            togglePausa
        );

    }


    /* =========================================================
       EVENTO - TERMINAR
       ========================================================= */

    if (
        btnTerminar
    ) {

        btnTerminar.addEventListener(
            "click",
            terminar
        );

    }


    /* =========================================================
       CERRAR DIALOG HACIENDO CLICK FUERA
       ========================================================= */

    dialog.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                dialog
            ) {

                closeDialog();

            }

        }
    );


    /* =========================================================
       SUBMIT - PROGRAMAR
       ========================================================= */

    form.addEventListener(
        "submit",
        event => {

            event.preventDefault();


            programarReunion();

        }
    );


    /* =========================================================
       EVENTO GLOBAL
       INICIAR REUNIÓN PROGRAMADA
       ========================================================= */

    document.addEventListener(
        "flow:iniciar-reunion",
        event => {

            if (
                !event.detail ||
                !event.detail.id
            ) {

                return;

            }


            iniciarReunionProgramada(
                event.detail.id
            );

        }
    );


    /* =========================================================
       ESTADO INICIAL
       ========================================================= */

    setBotonesReunionActiva(
        false
    );


    /* =========================================================
       API PÚBLICA
       ========================================================= */

    return {

        programarReunion,

        iniciarReunionProgramada,

        setBotonesReunionActiva

    };

}