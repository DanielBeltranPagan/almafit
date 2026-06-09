// --- IMPORTACIONES DE SDK DE FIREBASE (AUTH Y DATABASE) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBEDtqDtx0gvmq2ugnMXM1yD_huK7IaXqE",
  authDomain: "webfit-3255e.firebaseapp.com",
  databaseURL:
    "https://webfit-3255e-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "webfit-3255e",
  storageBucket: "webfit-3255e.firebasestorage.app",
  messagingSenderId: "76497239399",
  appId: "1:76497239399:web:0145d3b78bc31aaf2903c2",
  measurementId: "G-6LLSH4YR5V",
};

// Inicializar servicios
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Variables de estado
let usuarioActual = null;
let fechaActualCalendario = new Date();
let filtroCaloriasActual = "hoy";

let misEjercicios = [];
let misRutinas = [];
let historialEntrenamientos = [];
let datosPerfil = null;

// --- CONTROL DE SESIÓN (AUTH) ---
onAuthStateChanged(auth, async (user) => {
  const viewAuth = document.getElementById("view-auth");
  const appContent = document.getElementById("app-content");

  if (user) {
    // Usuario logueado con éxito
    usuarioActual = user;
    viewAuth.classList.add("d-none");
    appContent.classList.remove("d-none");

    // Descargamos los datos específicos de este UID de usuario
    await cargarDatosDesdeFirebase();
  } else {
    // No hay sesión activa
    usuarioActual = null;
    viewAuth.classList.remove("d-none");
    appContent.classList.add("d-none");
  }
});

// Registrar nuevo usuario
document.getElementById("btn-register").addEventListener("click", async () => {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;

  if (!email || !password) {
    alert("Rellena todos los campos.");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("¡Usuario registrado correctamente!");
  } catch (error) {
    alert("Error en registro: " + error.message);
  }
});

// Iniciar sesión
document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Error de acceso: " + error.message);
  }
});

// Cerrar sesión
document.getElementById("btn-logout").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error al salir:", error);
  }
});

// --- REALTIME DATABASE BASADA EN EL USER UID ---
async function cargarDatosDesdeFirebase() {
  if (!usuarioActual) return;
  try {
    // Los datos cuelgan de: almafit/uid_del_usuario
    const snapshot = await get(ref(db, `almafit/${usuarioActual.uid}`));
    if (snapshot.exists()) {
      const data = snapshot.val();
      misEjercicios = data.ejercicios || [];
      misRutinas = data.rutinas || [];
      historialEntrenamientos = data.historial || [];
      datosPerfil = data.perfil || null;
    } else {
      // Limpieza si entra una cuenta nueva totalmente limpia
      misEjercicios = [];
      misRutinas = [];
      historialEntrenamientos = [];
      datosPerfil = null;
    }
    inicializarAppVisual();
  } catch (error) {
    console.error("Error descargando datos: ", error);
    inicializarAppVisual();
  }
}

async function sincronizarFirebase(nodo, datos) {
  if (!usuarioActual) return;
  try {
    await set(ref(db, `almafit/${usuarioActual.uid}/${nodo}`), datos);
  } catch (error) {
    console.error(`Error guardando nodo ${nodo}: `, error);
  }
}

function inicializarAppVisual() {
  cargarPerfilEnInputs();
  renderizarEjercicios();
  renderizarCheckboxesRutina();
  renderizarRutinas();
  actualizarPantallaInicio();
  // Volver a la Home por defecto tras loguearse
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelector('.nav-btn[data-target="view-home"]')
    .classList.add("active");
  document
    .querySelectorAll(".view-section")
    .forEach((sec) => sec.classList.add("d-none"));
  document.getElementById("view-home").classList.remove("d-none");
}

// --- LÓGICA DE NAVEGACIÓN DE PANTALLAS ---
const navButtons = document.querySelectorAll(".nav-btn");
const sections = document.querySelectorAll(".view-section");

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!usuarioActual) return;
    navButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    sections.forEach((sec) => sec.classList.add("d-none"));
    const targetId = btn.getAttribute("data-target");
    document.getElementById(targetId).classList.remove("d-none");

    if (targetId === "view-home") {
      actualizarPantallaInicio();
    }
    if (targetId === "view-calendar") {
      fechaActualCalendario = new Date();
      renderizarCalendario();
    }
    if (targetId === "view-routines") {
      cancelarModoEdicion();
      renderizarCheckboxesRutina();
    }
    if (targetId === "view-workout") {
      document.getElementById("tab-pesas").click();
      prepararPantallaEntrenamiento();
    }
  });
});

// --- GESTIÓN DEL PERFIL DE USUARIO ---
const profileForm = document.getElementById("profile-form");
const usernameInput = document.getElementById("username");
const ageInput = document.getElementById("age");
const genderInput = document.getElementById("gender");
const weightInput = document.getElementById("weight");
const heightInput = document.getElementById("height");

function cargarPerfilEnInputs() {
  if (datosPerfil) {
    usernameInput.value = datosPerfil.nombre || "";
    ageInput.value = datosPerfil.edad || "";
    genderInput.value = datosPerfil.sexo || "hombre";
    weightInput.value = datosPerfil.peso || "";
    heightInput.value = datosPerfil.altura || "";
  } else {
    usernameInput.value = "";
    ageInput.value = "";
    genderInput.value = "hombre";
    weightInput.value = "";
    heightInput.value = "";
  }
}

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  datosPerfil = {
    nombre: usernameInput.value.trim(),
    edad: parseInt(ageInput.value),
    sexo: genderInput.value,
    peso: parseFloat(weightInput.value),
    altura: parseInt(heightInput.value),
  };

  await sincronizarFirebase("perfil", datosPerfil);
  alert("¡Perfil guardado!");
  actualizarPantallaInicio();
});

// --- BANCO DE EJERCICIOS ---
const exerciseForm = document.getElementById("exercise-form");
const exerciseNameInput = document.getElementById("exercise-name");
const exerciseMuscleInput = document.getElementById("exercise-muscle");
const exerciseList = document.getElementById("exercise-list");

function renderizarEjercicios() {
  exerciseList.innerHTML = "";
  if (misEjercicios.length === 0) {
    exerciseList.innerHTML =
      '<li style="color: var(--text-muted); font-size: 0.9rem; text-align:center; list-style:none;">No hay ejercicios creados aún.</li>';
    return;
  }
  misEjercicios.forEach((ejercicio) => {
    const li = document.createElement("li");
    li.classList.add("exercise-item");
    li.innerHTML = `
            <span>${ejercicio.nombre}</span>
            <div class="exercise-actions">
                <span class="muscle-tag">${ejercicio.musculo}</span>
                <button class="btn-delete-ex" data-id="${ejercicio.id}">🗑️</button>
            </div>
        `;
    exerciseList.appendChild(li);
  });

  document.querySelectorAll(".btn-delete-ex").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const idABorrar = parseInt(e.target.getAttribute("data-id"));
      await eliminarEjercicio(idABorrar);
    });
  });
}

async function eliminarEjercicio(id) {
  misEjercicios = misEjercicios.filter((ejercicio) => ejercicio.id !== id);
  actualizarRutinasAlBorrarEjercicio(id);

  await sincronizarFirebase("ejercicios", misEjercicios);
  await sincronizarFirebase("rutinas", misRutinas);

  renderizarEjercicios();
  renderizarCheckboxesRutina();
  renderizarRutinas();
  actualizarPantallaInicio();
}

function actualizarRutinasAlBorrarEjercicio(ejercicioId) {
  misRutinas = misRutinas.map((rutina) => {
    return {
      ...rutina,
      ejerciciosIDs: rutina.ejerciciosIDs.filter((id) => id !== ejercicioId),
    };
  });
}

exerciseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nuevoEjercicio = {
    id: Date.now(),
    nombre: exerciseNameInput.value.trim(),
    musculo: exerciseMuscleInput.value,
  };
  misEjercicios.push(nuevoEjercicio);

  await sincronizarFirebase("ejercicios", misEjercicios);

  exerciseNameInput.value = "";
  exerciseMuscleInput.value = "";
  renderizarEjercicios();
});

// --- CREACIÓN Y EDICIÓN DE RUTINAS ---
const routineForm = document.getElementById("routine-form");
const routineNameInput = document.getElementById("routine-name");
const checkboxesContainer = document.getElementById(
  "routine-exercise-checkboxes",
);
const routineList = document.getElementById("routine-list");
const editRoutineIdInput = document.getElementById("edit-routine-id");
const routineFormTitle = document.getElementById("routine-form-title");
const btnRoutineSubmit = document.getElementById("btn-routine-submit");
const btnCancelEdit = document.getElementById("btn-cancel-edit");

function renderizarCheckboxesRutina() {
  checkboxesContainer.innerHTML = "";
  if (misEjercicios.length === 0) {
    checkboxesContainer.innerHTML =
      '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 5px;">Crea primero ejercicios en su pestaña.</p>';
    return;
  }
  misEjercicios.forEach((ej) => {
    const label = document.createElement("label");
    label.classList.add("checkbox-item");
    label.innerHTML = `
            <input type="checkbox" value="${ej.id}" name="routine-exercises">
            <span>${ej.nombre}</span>
        `;
    checkboxesContainer.appendChild(label);
  });
}

function renderizarRutinas() {
  routineList.innerHTML = "";
  if (misRutinas.length === 0) {
    routineList.innerHTML =
      '<p style="color: var(--text-muted); font-size: 0.9rem; text-align:center;">No tienes rutinas creadas.</p>';
    return;
  }
  misRutinas.forEach((rutina) => {
    const tagsEjercicios = rutina.ejerciciosIDs
      .map((id) => {
        const encontrado = misEjercicios.find((e) => e.id === id);
        return encontrado
          ? `<span class="mini-exercise-tag">${encontrado.nombre}</span>`
          : "";
      })
      .join("");

    const div = document.createElement("div");
    div.classList.add("routine-card-item");
    div.innerHTML = `
            <div class="routine-card-header">
                <h4>${rutina.nombre}</h4>
                <div>
                    <button class="btn-edit" data-id="${rutina.id}">✏️</button>
                    <button class="btn-delete" data-id="${rutina.id}">🗑️</button>
                </div>
            </div>
            <div class="routine-mini-exercises">${tagsEjercicios}</div>
        `;
    routineList.appendChild(div);
  });

  routineList.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      eliminarRutina(parseInt(e.target.getAttribute("data-id"))),
    );
  });
  routineList.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      activarModoEdicion(parseInt(e.target.getAttribute("data-id"))),
    );
  });
}

async function eliminarRutina(id) {
  if (editRoutineIdInput.value == id) cancelarModoEdicion();
  misRutinas = misRutinas.filter((r) => r.id !== id);

  await sincronizarFirebase("rutinas", misRutinas);
  renderizarRutinas();
}

function activarModoEdicion(id) {
  const rutina = misRutinas.find((r) => r.id === id);
  if (!rutina) return;
  editRoutineIdInput.value = rutina.id;
  routineNameInput.value = rutina.nombre;
  routineFormTitle.textContent = "Editando rutina: " + rutina.nombre;
  btnRoutineSubmit.textContent = "Actualizar Rutina";
  btnCancelEdit.classList.remove("d-none");
  document
    .querySelector("#view-routines .profile-card")
    .classList.add("editing-mode");
  document.querySelectorAll('input[name="routine-exercises"]').forEach((cb) => {
    cb.checked = rutina.ejerciciosIDs.includes(parseInt(cb.value));
  });
}

function cancelarModoEdicion() {
  editRoutineIdInput.value = "";
  routineNameInput.value = "";
  routineFormTitle.textContent = "Nombre de la Rutina";
  btnRoutineSubmit.textContent = "Crear Rutina";
  btnCancelEdit.classList.add("d-none");
  document
    .querySelector("#view-routines .profile-card")
    .classList.remove("editing-mode");
  document
    .querySelectorAll('input[name="routine-exercises"]')
    .forEach((cb) => (cb.checked = false));
}

btnCancelEdit.addEventListener("click", cancelarModoEdicion);

routineForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const checkedBoxes = document.querySelectorAll(
    'input[name="routine-exercises"]:checked',
  );
  const ejerciciosSeleccionadosIDs = Array.from(checkedBoxes).map((cb) =>
    parseInt(cb.value),
  );
  if (ejerciciosSeleccionadosIDs.length === 0) {
    alert("Selecciona al menos un ejercicio.");
    return;
  }
  const idEdicion = editRoutineIdInput.value;
  if (idEdicion) {
    misRutinas = misRutinas.map((r) =>
      r.id === parseInt(idEdicion)
        ? {
            ...r,
            nombre: routineNameInput.value.trim(),
            ejerciciosIDs: ejerciciosSeleccionadosIDs,
          }
        : r,
    );
  } else {
    misRutinas.push({
      id: Date.now(),
      nombre: routineNameInput.value.trim(),
      ejerciciosIDs: ejerciciosSeleccionadosIDs,
    });
  }

  await sincronizarFirebase("rutinas", misRutinas);
  cancelarModoEdicion();
  renderizarRutinas();
});

// --- MODO ENTRENAMIENTO ---
const tabPesas = document.getElementById("tab-pesas");
const tabCardio = document.getElementById("tab-cardio");
const blockPesasContent = document.getElementById("block-pesas-content");
const blockCardioContent = document.getElementById("block-cardio-content");

tabPesas.addEventListener("click", () => {
  tabPesas.style.backgroundColor = "var(--accent)";
  tabCardio.style.backgroundColor = "#64748b";
  blockPesasContent.classList.remove("d-none");
  blockCardioContent.classList.add("d-none");
});

tabCardio.addEventListener("click", () => {
  tabCardio.style.backgroundColor = "var(--accent)";
  tabPesas.style.backgroundColor = "#64748b";
  blockCardioContent.classList.remove("d-none");
  blockPesasContent.classList.add("d-none");
});

const workoutSelect = document.getElementById("workout-routine-select");
const workoutExercisesContainer = document.getElementById(
  "workout-exercises-container",
);
const btnFinishWorkout = document.getElementById("btn-finish-workout");

function prepararPantallaEntrenamiento() {
  workoutSelect.innerHTML =
    '<option value="" disabled selected>Selecciona una rutina</option>';
  if (misRutinas.length === 0) {
    workoutExercisesContainer.innerHTML =
      '<p style="text-align: center; color: var(--text-muted); margin-top: 20px;">Crea una rutina primero para poder entrenar.</p>';
    btnFinishWorkout.classList.add("d-none");
    return;
  }
  misRutinas.forEach((rutina) => {
    const opt = document.createElement("option");
    opt.value = rutina.id;
    opt.textContent = rutina.nombre;
    workoutSelect.appendChild(opt);
  });
}

workoutSelect.addEventListener("change", (e) => {
  const rutinaId = parseInt(e.target.value);
  const rutinaSeleccionada = misRutinas.find((r) => r.id === rutinaId);
  workoutExercisesContainer.innerHTML = "";

  if (!rutinaSeleccionada || rutinaSeleccionada.ejerciciosIDs.length === 0) {
    workoutExercisesContainer.innerHTML =
      '<p style="text-align: center; color: var(--text-muted);">Esta rutina no tiene ejercicios asignados.</p>';
    btnFinishWorkout.classList.add("d-none");
    return;
  }

  rutinaSeleccionada.ejerciciosIDs.forEach((ejId) => {
    const ejercicio = misEjercicios.find((e) => e.id === ejId);
    if (!ejercicio) return;

    const block = document.createElement("div");
    block.classList.add("workout-exercise-block");
    block.setAttribute("data-exercise-id", ejId);
    block.innerHTML = `
            <h4>${ejercicio.nombre}</h4>
            <div class="series-row-header">
                <div>SERIE</div>
                <div>KG</div>
                <div>REPS</div>
            </div>
            ${[1, 2, 3]
              .map(
                (num) => `
                <div class="series-row" data-serie="${num}">
                    <div class="series-number">S${num}</div>
                    <input type="number" step="0.5" placeholder="0" class="series-input input-kg">
                    <input type="number" placeholder="0" class="series-input input-reps">
                </div>
            `,
              )
              .join("")}
        `;
    workoutExercisesContainer.appendChild(block);
  });
  btnFinishWorkout.classList.remove("d-none");
});

btnFinishWorkout.addEventListener("click", async () => {
  if (!datosPerfil) {
    alert('Por favor, rellena tu "Perfil" primero para calcular calorías.');
    return;
  }

  let seriesCompletadas = 0;
  const bloquesEjercicios = workoutExercisesContainer.querySelectorAll(
    ".workout-exercise-block",
  );
  bloquesEjercicios.forEach((bloque) => {
    bloque.querySelectorAll(".series-row").forEach((fila) => {
      if (
        fila.querySelector(".input-kg").value ||
        fila.querySelector(".input-reps").value
      ) {
        seriesCompletadas++;
      }
    });
  });

  if (seriesCompletadas === 0) {
    alert("No has anotado ninguna serie.");
    return;
  }

  let caloriasAprox = Math.round(
    seriesCompletadas * datosPerfil.weight * 0.1 ||
      seriesCompletadas * datosPerfil.peso * 0.1,
  );
  if (datosPerfil.sexo === "hombre")
    caloriasAprox = Math.round(caloriasAprox * 1.1);

  await guardarEnHistorial(
    "Musculación",
    workoutSelect.options[workoutSelect.selectedIndex].text,
    `${seriesCompletadas} series`,
    caloriasAprox,
  );

  alert(
    `¡Entrenamiento guardado!\nSeries: ${seriesCompletadas}\nCalorías: ~${caloriasAprox} kcal.`,
  );
  workoutExercisesContainer.innerHTML =
    '<p style="text-align: center; color: var(--text-muted); margin-top: 20px;">Selecciona una rutina para empezar.</p>';
  btnFinishWorkout.classList.add("d-none");
  document.querySelector('.nav-btn[data-target="view-home"]').click();
});

const cardioForm = document.getElementById("cardio-form");
const cardioTimeInput = document.getElementById("cardio-time");
const cardioSpeedInput = document.getElementById("cardio-speed");
const cardioInclineInput = document.getElementById("cardio-incline");

cardioForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!datosPerfil) {
    alert('Por favor, rellena tu "Perfil" primero.');
    return;
  }

  const tiempo = parseFloat(cardioTimeInput.value);
  const velocidadKMH = parseFloat(cardioSpeedInput.value);
  const inclinacionPorcentaje = parseFloat(cardioInclineInput.value);
  const pesoUser = datosPerfil.peso || datosPerfil.weight;

  let velocidadMetrosMin = velocidadKMH * 16.667;
  let fraccionInclinacion = inclinacionPorcentaje / 100;
  let vo2 =
    0.2 * velocidadMetrosMin +
    0.9 * velocidadMetrosMin * fraccionInclinacion +
    3.5;
  let kcalPorMinuto = vo2 * pesoUser * 0.005;
  let caloriasCardio = Math.round(kcalPorMinuto * tiempo);

  await guardarEnHistorial(
    "Cardio",
    `Cinta (${velocidadKMH} km/h, ${inclinacionPorcentaje}% incl.)`,
    `${tiempo} min`,
    caloriasCardio,
  );
  alert(`¡Sesión de Cardio registrada! ~${caloriasCardio} kcal.`);

  cardioTimeInput.value = "";
  cardioSpeedInput.value = "";
  cardioInclineInput.value = "";
  document.querySelector('.nav-btn[data-target="view-home"]').click();
});

async function guardarEnHistorial(tipo, detalle, volumen, kcal) {
  const hoy = new Date();
  const fechaFormateada = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;

  const nuevoRegistro = {
    id: Date.now(),
    fecha: fechaFormateada,
    timestamp: hoy.getTime(),
    tipo: tipo,
    detalle: detalle,
    volumen: volumen,
    calorias: kcal,
  };
  historialEntrenamientos.push(nuevoRegistro);
  await sincronizarFirebase("historial", historialEntrenamientos);
}

// --- DINÁMICA DE CALORÍAS HOY VS SEMANA (ARREGLADO) ---
function actualizarPantallaInicio() {
  const welcomeName = document.getElementById("welcome-name");
  const statExercises = document.getElementById("stat-exercises");
  const calStatTitle = document.getElementById("cal-stat-title");
  const statCaloriesBurn = document.getElementById("stat-calories-burn");
  const btnToggleCal = document.getElementById("btn-toggle-cal");

  if (datosPerfil && datosPerfil.nombre) {
    welcomeName.textContent = `, ${datosPerfil.nombre.split(" ")[0]}!`;
  } else {
    welcomeName.textContent = "!";
  }

  if (statExercises) statExercises.textContent = misEjercicios.length;

  const ahora = new Date();
  const stringHoy = `${ahora.getDate()}/${ahora.getMonth() + 1}/${ahora.getFullYear()}`;

  const diaSemana = ahora.getDay();
  const diferenciaAlLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunesSemana = new Date(ahora);
  lunesSemana.setDate(ahora.getDate() + diferenciaAlLunes);
  lunesSemana.setHours(0, 0, 0, 0);

  const domingoSemana = new Date(lunesSemana);
  domingoSemana.setDate(lunesSemana.getDate() + 6);
  domingoSemana.setHours(23, 59, 59, 999);

  let sumaCalorias = 0;

  historialEntrenamientos.forEach((item) => {
    let itemFecha;
    if (item.timestamp) {
      itemFecha = new Date(item.timestamp);
    } else {
      const partes = item.fecha.split("/");
      itemFecha = new Date(
        parseInt(partes[2]),
        parseInt(partes[1]) - 1,
        parseInt(partes[0]),
      );
    }

    if (filtroCaloriasActual === "hoy") {
      if (item.fecha === stringHoy) {
        sumaCalorias += item.calorias || 0;
      }
    } else {
      if (itemFecha >= lunesSemana && itemFecha <= domingoSemana) {
        sumaCalorias += item.calorias || 0;
      }
    }
  });

  // Cambia sincrónicamente el título y el botón según lo que estés viendo
  if (filtroCaloriasActual === "hoy") {
    calStatTitle.textContent = "Calorías Hoy";
    btnToggleCal.textContent = "🗓️ Semana";
  } else {
    calStatTitle.textContent = "Calorías Semana";
    btnToggleCal.textContent = "☀️ Hoy";
  }

  if (statCaloriesBurn) {
    statCaloriesBurn.textContent = `${sumaCalorias} kcal`;
  }
}

document.getElementById("btn-toggle-cal").addEventListener("click", () => {
  filtroCaloriasActual = filtroCaloriasActual === "hoy" ? "semana" : "hoy";
  actualizarPantallaInicio();
});

// --- CALENDARIO ---
const meses = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function renderizarCalendario() {
  const mesAnioLabel = document.getElementById("calendar-month-year");
  const grid = document.getElementById("calendar-grid");
  if (!grid || !mesAnioLabel) return;

  const anio = fechaActualCalendario.getFullYear();
  const mes = fechaActualCalendario.getMonth();

  mesAnioLabel.textContent = `${meses[mes]} ${anio}`;
  grid.innerHTML = "";

  const primerDiaMes = new Date(anio, mes, 1);
  let indiceDiaSemana = primerDiaMes.getDay() - 1;
  if (indiceDiaSemana === -1) indiceDiaSemana = 6;

  const totalDiasMes = new Date(anio, mes + 1, 0).getDate();

  for (let i = 0; i < indiceDiaSemana; i++) {
    const divVacio = document.createElement("div");
    divVacio.classList.add("calendar-day", "empty");
    grid.appendChild(divVacio);
  }

  const hoy = new Date();
  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const diaDiv = document.createElement("div");
    diaDiv.classList.add("calendar-day");
    diaDiv.textContent = dia;

    if (
      dia === hoy.getDate() &&
      mes === hoy.getMonth() &&
      anio === hoy.getFullYear()
    ) {
      diaDiv.classList.add("today");
    }

    const fechaKey = `${dia}/${mes + 1}/${anio}`;
    const entrenamientosDelDia = historialEntrenamientos.filter(
      (item) => item.fecha === fechaKey,
    );

    if (entrenamientosDelDia.length > 0) {
      const containerDots = document.createElement("div");
      containerDots.classList.add("day-indicators");

      const tiposUnicos = [...new Set(entrenamientosDelDia.map((i) => i.tipo))];
      tiposUnicos.forEach((tipo) => {
        const dot = document.createElement("span");
        dot.classList.add(
          "ind-dot",
          tipo === "Cardio" ? "cardio" : "musculacion",
        );
        containerDots.appendChild(dot);
      });
      diaDiv.appendChild(containerDots);
    }

    diaDiv.addEventListener("click", () => {
      document
        .querySelectorAll(".calendar-day")
        .forEach((d) => d.classList.remove("selected"));
      diaDiv.classList.add("selected");
      mostrarDetalleDia(fechaKey, entrenamientosDelDia);
    });

    grid.appendChild(diaDiv);
  }

  const stringHoy = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;
  const entrenamientosHoy = historialEntrenamientos.filter(
    (item) => item.fecha === stringHoy,
  );

  if (mes === hoy.getMonth() && anio === hoy.getFullYear()) {
    mostrarDetalleDia(`Hoy (${stringHoy})`, entrenamientosHoy);
  } else {
    mostrarDetalleDia(`Selecciona un día`, []);
  }
}

function mostrarDetalleDia(tituloFecha, entrenamientos) {
  const listContainer = document.getElementById("day-history-list");
  const detailTitle = document.getElementById("day-detail-title");
  if (!listContainer || !detailTitle) return;

  detailTitle.textContent = `Resultados: ${tituloFecha}`;
  listContainer.innerHTML = "";

  if (entrenamientos.length === 0) {
    listContainer.innerHTML =
      '<p style="color: var(--text-muted); font-size: 0.85rem; text-align:center; padding: 10px 0;">Ningún entrenamiento registrado en esta fecha.</p>';
    return;
  }

  entrenamientos.forEach((item) => {
    const card = document.createElement("div");
    card.className = `history-item-card ${item.tipo === "Cardio" ? "type-cardio" : ""}`;
    card.innerHTML = `
            <div class="history-item-details">
                <h4>${item.detalle}</h4>
                <p>${item.tipo} · ${item.volumen}</p>
            </div>
            <div class="history-item-stats">
                <span class="history-item-kcal">${item.calorias} kcal</span>
            </div>
        `;
    listContainer.appendChild(card);
  });
}

document.getElementById("btn-prev-month").addEventListener("click", () => {
  fechaActualCalendario.setMonth(fechaActualCalendario.getMonth() - 1);
  renderizarCalendario();
});

document.getElementById("btn-next-month").addEventListener("click", () => {
  fechaActualCalendario.setMonth(fechaActualCalendario.getMonth() + 1);
  renderizarCalendario();
});

document
  .getElementById("btn-clear-history")
  .addEventListener("click", async () => {
    if (
      confirm(
        "¿Seguro que quieres borrar por completo todo tu historial de entrenamientos en la nube?",
      )
    ) {
      historialEntrenamientos = [];
      await sincronizarFirebase("historial", []);
      renderizarCalendario();
      actualizarPantallaInicio();
    }
  });
