import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = window.db;

const fechaInput = document.getElementById("fecha");
const horariosDiv = document.getElementById("horarios");
const aplicarBtn = document.getElementById("aplicarHorario");
const editarTurnoBtn = document.getElementById("editarTurnoBtn");
const detalleSeleccion = document.getElementById("detalleSeleccion");

const nombreInput = document.getElementById("nombre");
const telefonoInput = document.getElementById("telefono");
const servicioSelect = document.getElementById("servicio");
const mensajeInput = document.getElementById("mensaje");
const form = document.getElementById("formTurno");
const confirmacionDiv = document.getElementById("confirmacion");

let horarioSeleccionado = null;
let horarioConfirmado = null;

function esDomingo(fecha) {
  return fecha.getDay() === 0;
}

async function obtenerHorariosBloqueados(fecha) {
  const ref = doc(db, "bloqueos", fecha);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().horarios : [];
}

async function bloquearHorario(fecha, hora) {
  const ref = doc(db, "bloqueos", fecha);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    if (!data.horarios.includes(hora)) {
      data.horarios.push(hora);
      await updateDoc(ref, { horarios: data.horarios, turnos: data.turnos });
    }
  } else {
    await setDoc(ref, { horarios: [hora], turnos: { [hora]: duracion } });

  }
}

async function desbloquearHorario(fecha, hora) {
  const ref = doc(db, "bloqueos", fecha);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    let horarios = snap.data().horarios.filter(h => h !== hora);
    await updateDoc(ref, { horarios });
  }
}
const duracionesServicios = {
  "Manicuría tradicional - $2600": 60,
  "Manicuría + esmaltado tradicional - $5200": 60,
  "Manicuría + esmaltado semipermanente - $9500": 120,
  "Capping con base rubber + esmaltado semipermanente hasta largo 2 - $11500": 120,
  "Capping en acrygel/gel + esmaltado semipermanente hasta largo 2 - $12500": 120,
  "Extensiones en Soft Gel hasta largo 3 - $14000": 120,
  "Esculpidas hasta largo 2 - $14000": 120,
  "Retiro de esmaltado semipermanente de otro salón - $3000": 30,
  "Retiro de capping de otro salón - $4000": 30,
  "Retiro de esculpidas/Soft gel de otro salón - $4500": 30
};

async function cargarHorarios() {
  horariosDiv.innerHTML = "";
  horarioSeleccionado = null;
  horarioConfirmado = null;
  detalleSeleccion.textContent = "";
  aplicarBtn.style.display = "none";
  editarTurnoBtn.style.display = "none";
  horariosDiv.style.display = "grid";

  const fechaValor = fechaInput.value;
  if (!fechaValor) {
    horariosDiv.style.display = "none";
    return;
  }

  const fechaObj = new Date(fechaValor + "T00:00:00");
  if (esDomingo(fechaObj)) {
    alert("Los domingos no hay turnos disponibles.");
    fechaInput.value = "";
    horariosDiv.style.display = "none";
    return;
  }

  const bloqueados = await obtenerHorariosBloqueados(fechaValor);

  const inicio = 8 * 60 + 30;
  const fin = 18 * 60;

  for (let min = inicio; min <= fin; min += 15) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const horaStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const btn = document.createElement("div");

    if (bloqueados.includes(horaStr)) {
      btn.textContent = "Ocupado";
      btn.style.background = "#474646";
      btn.style.color = "#fff";
      btn.style.display = "flex";
      btn.style.justifyContent = "center";
      btn.style.alignItems = "center";
      btn.style.height = "40px";
      btn.style.borderRadius = "5px";
      btn.style.cursor = "pointer";
      btn.title = "Horario ocupado. Solo Noe puede desbloquear.";

      btn.addEventListener("click", async () => {
        const clave = prompt("Ingresá la clave para desbloquear el turno:");
        if (clave === "noelia05") {
          await desbloquearHorario(fechaValor, horaStr);
          cargarHorarios();
        } else {
          alert("Clave incorrecta.");
        }
      });

    } else {
      btn.textContent = horaStr;
      btn.className = "horario-btn";
      btn.addEventListener("click", () => {
        document.querySelectorAll(".horario-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        horarioSeleccionado = horaStr;
        aplicarBtn.style.display = "inline-block";
      });
    }

    horariosDiv.appendChild(btn);
  }
}

fechaInput.addEventListener("change", () => {
  cargarHorarios();
});

function calcularBloquesConsecutivos(horaInicial, duracionMin) {
  const bloques = [];
  const [h, m] = horaInicial.split(":").map(Number);
  let totalMin = h * 60 + m;

  const cantidadBloques = duracionMin / 15;

  for (let i = 0; i < cantidadBloques; i++) {
    const horas = Math.floor(totalMin / 60);
    const minutos = totalMin % 60;
    bloques.push(`${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`);
    totalMin += 15;
  }

  return bloques;
}

aplicarBtn.addEventListener("click", async () => {
  if (!horarioSeleccionado) {
    alert("Selecciona un horario primero.");
    return;
  }

  const fecha = fechaInput.value;
  const servicio = servicioSelect.value;
  const duracion = duracionesServicios[servicio] || 60;

  const bloquesAConfirmar = calcularBloquesConsecutivos(horarioSeleccionado, duracion);

  // Verificá que ninguno esté ya ocupado antes de confirmar
  const bloqueados = await obtenerHorariosBloqueados(fecha);
  const conflicto = bloquesAConfirmar.some(hora => bloqueados.includes(hora));

  if (conflicto) {
    alert("Uno o más bloques necesarios para este turno ya están ocupados. Elegí otro horario.");
    return;
  }

  // Bloqueá todos los horarios necesarios
  for (const hora of bloquesAConfirmar) {
    await bloquearHorario(fecha, hora);
  }

  horarioConfirmado = horarioSeleccionado;
  detalleSeleccion.textContent = `Turno confirmado para el ${fecha} a las ${horarioConfirmado} (${duracion} minutos)`;
  aplicarBtn.style.display = "none";
  editarTurnoBtn.style.display = "inline-block";

  document.querySelectorAll(".horario-btn").forEach(btn => btn.style.pointerEvents = "none");
});

editarTurnoBtn.addEventListener("click", () => {
  horarioConfirmado = null;
  detalleSeleccion.textContent = "";
  aplicarBtn.style.display = "none";
  editarTurnoBtn.style.display = "none";
  horarioSeleccionado = null;
  cargarHorarios();
});

form.addEventListener("submit", async e => {
  e.preventDefault();

  if (!horarioConfirmado) {
    alert("Por favor, confirma tu horario haciendo clic en 'Aplicar'.");
    return;
  }

  const nombre = nombreInput.value.trim();
  const telefono = telefonoInput.value.trim();
  const servicio = servicioSelect.value;
  const fecha = fechaInput.value;

  if (!nombre || !telefono || !servicio || !fecha) {
    alert("Por favor, completá todos los datos.");
    return;
  }

  const mensaje =
    `Hola, soy ${nombre}. Quiero reservar un turno para el ${fecha} a las ${horarioConfirmado}.\n` +
    `Servicio: ${servicio}.\n` +
    (mensajeInput.value.trim() ? `Mensaje adicional: ${mensajeInput.value.trim()}\n` : "") +
    `Mi teléfono es ${telefono}.`;

  const urlWhatsapp = `https://wa.me/5491130669623?text=${encodeURIComponent(mensaje)}`;
  mostrarConfirmacion();

  setTimeout(() => {
    window.open(urlWhatsapp, "_blank");
  }, 1000);

  form.reset();
  detalleSeleccion.textContent = "";
  horarioConfirmado = null;
  horarioSeleccionado = null;
  horariosDiv.style.display = "none";
  aplicarBtn.style.display = "none";
  editarTurnoBtn.style.display = "none";
});

function mostrarConfirmacion() {
  confirmacionDiv.classList.remove("hidden");
  confirmacionDiv.classList.add("show");
}

window.cerrarConfirmacion = function () {
  confirmacionDiv.classList.remove("show");
  confirmacionDiv.classList.add("hidden");
};

document.getElementById("btnReservas").addEventListener("click", () => {
  document.getElementById("vistaReservas").style.display = "block";
  document.getElementById("vistaPrecios").style.display = "none";
  document.getElementById("btnReservas").classList.add("activo");
  document.getElementById("btnPrecios").classList.remove("activo");
});

document.getElementById("btnPrecios").addEventListener("click", () => {
  document.getElementById("vistaReservas").style.display = "none";
  document.getElementById("vistaPrecios").style.display = "block";
  document.getElementById("btnPrecios").classList.add("activo");
  document.getElementById("btnReservas").classList.remove("activo");
});
