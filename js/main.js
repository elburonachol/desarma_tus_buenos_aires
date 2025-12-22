/*
 * ARCHIVO PRINCIPAL - COORDINACIÓN GENERAL
 * 
 * Este archivo es el "cerebro" de la aplicación:
 * - Inicializa todos los módulos
 * - Mantiene el estado global
 * - Coordina la comunicación entre módulos
 * - Maneja variables compartidas
 */

// =============================================
// VARIABLES GLOBALES COMPARTIDAS
// =============================================

// Estado del mapa y datos geoespaciales
let map;                    // Instancia principal del mapa Leaflet
let geoJsonLayer;           // Capa GeoJSON con todos los departamentos
let allDepartments = [];    // Array con TODOS los departamentos (para reset)

// Estado de las divisiones y agrupamientos
let departmentGroups = {};  // {1: {color: '#ff0000', departments: [], name: 'División 1'}, ...}
let currentDivisionCount = 3; // Número actual de divisiones visibles

// Datos externos cargados
let partidosData = null;    // Datos de superficie/población desde datos_partidos.json
let regionesExistentes = null; // Regiones predefinidas desde regiones_existentes.json

// Estado de regiones existentes
let currentRegionType = null; // 'secciones_electorales' o 'regiones_sanitarias'

// Sistema de selección por polígono
let polygonMode = false;    // ¿Estamos en modo dibujo de polígono?
let polygonPoints = [];     // Puntos del polígono en construcción
let polygonLayer = null;    // Capa visual del polígono
let polylineLayer = null;   // Línea temporal del polígono
let selectedDepartments = []; // Departamentos seleccionados por polígono
let selectedDepartmentsSet = new Set(); // Para búsquedas rápidas
let pointMarkers = [];      // Marcadores de puntos del polígono

// =============================================
// CONSTANTES GLOBALES
// =============================================

// Paleta de colores para las divisiones (15 colores distinguibles y armónicos)
const divisionColors = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5'
];

// Códigos CDE de departamentos del Gran Buenos Aires (para destacado visual)
const gbaCodes = [
    '06028', '06035', '06091', '06260', '06270', '06274', 
    '06371', '06408', '06410', '06412', '06427', '06434', 
    '06490', '06515', '06539', '06560', '06568', '06658', 
    '06749', '06756', '06760', '06805', '06840', '06861'
];

// =============================================
// INICIALIZACIÓN DE LA APLICACIÓN
// =============================================

/**
 * PUNTO DE ENTRADA - Se ejecuta cuando la página termina de cargar
 * Orquesta la inicialización de todos los módulos en el orden correcto
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando aplicación...');
    
    // 1. Primero inicializamos el mapa (módulo map-core.js)
    initializeMap();
    
    // 2. Cargamos todos los datos necesarios en paralelo
    Promise.all([
        loadGeoJSON(),          // Datos geográficos de departamentos
        loadPartidosData(),     // Datos de superficie y población
        loadRegionesExistentes() // Regiones predefinidas
    ]).then(() => {
        console.log('✅ Todos los datos cargados correctamente');
        
        // 3. Inicializamos la interfaz de usuario
        initializeUI();
        
    }).catch(error => {
        console.error('❌ Error en la inicialización:', error);
        alert('Error al cargar los datos. Verifica la consola para más detalles.');
    });
});

/**
 * INICIALIZACIÓN DE LA INTERFAZ DE USUARIO
 * Configura todos los controles después de que los datos estén listos
 */
function initializeUI() {
    console.log('🎛️ Inicializando interfaz de usuario...');
    
    // Sistema de divisiones y drag & drop
    initializeDivisionBoxes(currentDivisionCount);
    
    // Controles principales
    setupResetButton();
    setupDivisionSelector(); 
    setupRegionSelector();
    setupPolygonButton();
    
    // Sistema de visualización de regionalizaciones (NUEVO)
    initializeRegionalizaciones();
    
    // Sistema de visualización de datos
    initializeComparisonTable();
    updateRemainingCount();
    
    console.log('✅ Interfaz de usuario inicializada');
}

// =============================================
// FUNCIONES DE COMUNICACIÓN ENTRE MÓDULOS
// =============================================

/**
 * Notifica a todos los módulos que deben actualizar sus visualizaciones
 * Se llama cuando cambia el estado de las divisiones
 */
function notifyStateChange() {
    updateDepartmentGroups();   // Actualiza la estructura de datos
    updateMapColors();          // Actualiza colores en el mapa
    updateComparisonTable();    // Actualiza tabla comparativa
    updateRemainingCount();     // Actualiza contadores
}

/**
 * Limpia toda la selección actual de departamentos
 * Útil después de mover grupos o cambiar modos
 */
function clearAllSelections() {
    selectedDepartments = [];
    selectedDepartmentsSet.clear();
    
    // Limpia selección visual en la interfaz
    document.querySelectorAll('.department-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    
    updateMapColors();
}

// =============================================
// FUNCIONES DE ACCESO GLOBAL (para otros módulos)
// =============================================

/**
 * Obtiene un departamento por su nombre
 * @param {string} departmentName - Nombre del departamento
 * @returns {Object|null} - Departamento encontrado o null
 */
function getDepartmentByName(departmentName) {
    return allDepartments.find(dept => dept.properties.nam === departmentName);
}

/**
 * Obtiene el código CDE de un departamento por su nombre  
 * @param {string} departmentName - Nombre del departamento
 * @returns {string|null} - Código CDE o null
 */
function getDepartmentCode(departmentName) {
    const dept = getDepartmentByName(departmentName);
    return dept ? dept.properties.cde : null;
}

/**
 * Verifica si un departamento pertenece al GBA
 * @param {string} departmentName - Nombre del departamento
 * @returns {boolean} - True si es del GBA
 */
function isGBADepartment(departmentName) {
    const code = getDepartmentCode(departmentName);
    return code ? gbaCodes.includes(code) : false;
}

// =============================================
// INICIALIZACIÓN DE MÓDULOS EXTERNOS
// =============================================

// Estas funciones se implementan en otros archivos pero se declaran aquí
// para que estén disponibles globalmente

function initializeMap() {
    // Implementado en map-core.js
}

function loadGeoJSON() {
    // Implementado en data-manager.js  
}

function loadPartidosData() {
    // Implementado en data-manager.js
}

function loadRegionesExistentes() {
    // Implementado en data-manager.js
}

function initializeDivisionBoxes(count) {
    // Implementado en ui-controls.js
}

function setupResetButton() {
    // Implementado en ui-controls.js
}

function setupDivisionSelector() {
    // Implementado en ui-controls.js
}

function setupRegionSelector() {
    // Implementado en ui-controls.js
}

function setupPolygonButton() {
    // Implementado en ui-controls.js
}

function initializeComparisonTable() {
    // Implementado en ui-controls.js
}

function updateRemainingCount() {
    // Implementado en ui-controls.js
}

function updateDepartmentGroups() {
    // Implementado en ui-controls.js
}

function updateMapColors() {
    // Implementado en map-core.js
}

function updateComparisonTable() {
    // Implementado en ui-controls.js
}
