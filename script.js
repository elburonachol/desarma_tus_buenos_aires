/*
 * MAPA INTERACTIVO - DIVISIÓN DE LA PROVINCIA DE BUENOS AIRES
 * 
 * FUNCIONALIDADES PRINCIPALES:
 * 1. Carga y visualización de mapa con fondo en escala de grises
 * 2. Carga de departamentos desde GeoJSON con filtro por campo "arl"
 * 3. Sistema de divisiones con colores dinámicos (1-10 divisiones)
 * 4. Drag & drop entre listado y divisiones
 * 5. Departamentos transparentes en listado, coloreados en divisiones
 * 6. Gestión inteligente de cambios en número de divisiones
 * 7. Reset completo del estado
 * 8. Ordenamiento alfabético automático en listado
 */

// Variables globales para el estado de la aplicación
let map;                    // Instancia del mapa Leaflet
let geoJsonLayer;           // Capa GeoJSON con los departamentos
let departmentGroups = {};  // Objeto que almacena las divisiones y sus departamentos
let allDepartments = [];    // Array con todos los departamentos (para reset)
let currentDivisionCount = 3; // Número actual de divisiones visibles

// Paleta de colores para las divisiones (10 colores distintos)
const divisionColors = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', 
    '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
];

/*
 * INICIALIZACIÓN DE LA APLICACIÓN
 * Se ejecuta cuando el DOM está completamente cargado
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    loadGeoJSON().then(() => {
        initializeDivisionBoxes(currentDivisionCount);
        setupResetButton();
        setupDivisionSelector();
    });
});

/*
 * INICIALIZACIÓN DEL MAPA LEAFLET
 * Configura el mapa con centro en Buenos Aires y fondo en escala de grises
 */
function initializeMap() {
    // Crear mapa centrado en la Provincia de Buenos Aires
    map = L.map('map').setView([-36.6769, -59.8499], 7);

    // Capa base en escala de grises (sin colores)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);
}

/*
 * CARGA DEL ARCHIVO GEOJSON
 * Filtra departamentos por campo "arl" y los ordena alfabéticamente
 */
function loadGeoJSON() {
    return fetch('partidos.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar el archivo GeoJSON');
            }
            return response.json();
        })
        .then(data => {
            // Filtrar features que tienen valor en el campo "arl"
            const filteredFeatures = data.features.filter(feature => 
                feature.properties.arl !== null && 
                feature.properties.arl !== undefined && 
                feature.properties.arl !== ''
            );

            console.log(`Departamentos cargados: ${filteredFeatures.length}`);

            // Ordenar alfabéticamente por el campo "nam"
            filteredFeatures.sort((a, b) => {
                const nameA = (a.properties.nam || '').toUpperCase();
                const nameB = (b.properties.nam || '').toUpperCase();
                return nameA.localeCompare(nameB);
            });

            // Guardar referencia a todos los departamentos (para reset)
            allDepartments = filteredFeatures;

            // Crear capa GeoJSON en el mapa
            geoJsonLayer = L.geoJSON(filteredFeatures, {
                style: function(feature) {
                    // Estilo por defecto: transparente (sin relleno) con borde visible
                    return {
                        fillColor: '#3388ff',
                        fillOpacity: 0,  // Transparente - sin relleno
                        color: '#333333', // Borde gris oscuro
                        weight: 1,
                        opacity: 0.7
                    };
                },
                onEachFeature: function(feature, layer) {
                    // Tooltip con el nombre del departamento
                    const nombre = feature.properties.nam || 'Sin nombre';
                    layer.bindTooltip(nombre);
                    
                    // Click para resaltar (debugging)
                    layer.on('click', function() {
                        highlightDepartment(feature.properties.nam);
                    });
                }
            }).addTo(map);

            // Ajustar vista del mapa para mostrar todos los departamentos
            map.fitBounds(geoJsonLayer.getBounds());
            
            // Poblar el listado de departamentos
            populateDepartmentsList(filteredFeatures);
            
            // Actualizar contador
            document.getElementById('dept-count').textContent = filteredFeatures.length;
        })
        .catch(error => {
            console.error('Error cargando el GeoJSON:', error);
            alert('Error al cargar el archivo GeoJSON. Verifica la consola para más detalles.');
        });
}

/*
 * INICIALIZACIÓN DE CAJAS DE DIVISIÓN
 * Crea dinámicamente las cajas de división según el número especificado
 */
function initializeDivisionBoxes(newCount) {
    const container = document.getElementById('division-boxes-container');
    
    // Guardar el estado actual de las divisiones antes del cambio
    const previousGroups = { ...departmentGroups };
    
    // Si se reducen las divisiones, procesar las que se eliminarán
    if (newCount < currentDivisionCount) {
        processDivisionReduction(newCount, previousGroups);
    }
    
    // Actualizar contador actual
    currentDivisionCount = newCount;
    
    // Limpiar contenedor
    container.innerHTML = '';
    
    // Reinicializar objeto de grupos
    departmentGroups = {};
    
    // Crear nuevas cajas de división
    for (let i = 1; i <= newCount; i++) {
        const color = divisionColors[i - 1] || '#3388ff';
        departmentGroups[i] = { color: color, departments: [] };

        const groupBox = document.createElement('div');
        groupBox.className = 'group-box';
        groupBox.setAttribute('data-group-id', i);
        groupBox.style.borderLeft = `4px solid ${color}`;

        groupBox.innerHTML = `
            <h3>División ${i}</h3>
            <div class="group-list" id="division-${i}"></div>
        `;

        container.appendChild(groupBox);
        
        // Si existía esta división antes, restaurar sus departamentos
        if (previousGroups[i] && previousGroups[i].departments) {
            const divisionList = document.getElementById(`division-${i}`);
            previousGroups[i].departments.forEach(deptName => {
                const item = document.createElement('div');
                item.className = 'department-item';
                item.textContent = deptName;
                item.setAttribute('data-dept-name', deptName);
                divisionList.appendChild(item);
            });
        }
    }

    // Reinicializar sistema de drag & drop
    initializeDragAndDrop();
    
    // Actualizar estado y colores del mapa
    updateDepartmentGroups();
    updateMapColors();
}

/*
 * PROCESAMIENTO DE REDUCCIÓN DE DIVISIONES
 * Maneja la lógica cuando se reducen el número de divisiones
 */
function processDivisionReduction(newCount, previousGroups) {
    // Para cada división que será eliminada (las de más abajo)
    for (let i = newCount + 1; i <= currentDivisionCount; i++) {
        // Si esta división existía y tenía departamentos
        if (previousGroups[i] && previousGroups[i].departments) {
            // Devolver cada departamento al listado principal
            previousGroups[i].departments.forEach(deptName => {
                returnDepartmentToMainList(deptName);
            });
        }
    }
}

/*
 * CONFIGURACIÓN DEL SELECTOR DE DIVISIONES
 * Maneja los cambios en el menú desplegable de número de divisiones
 */
function setupDivisionSelector() {
    const selector = document.getElementById('division-count');
    selector.value = currentDivisionCount;
    
    selector.addEventListener('change', function() {
        const newCount = parseInt(this.value);
        initializeDivisionBoxes(newCount);
    });
}

/*
 * POBLADO DEL LISTADO DE DEPARTAMENTOS
 * Llena la lista principal con todos los departamentos ordenados
 */
function populateDepartmentsList(features) {
    const listContainer = document.getElementById('all-departments-list');
    listContainer.innerHTML = '';
    
    features.forEach(feature => {
        const nombre = feature.properties.nam;
        const item = document.createElement('div');
        item.className = 'department-item';
        item.textContent = nombre;
        item.setAttribute('data-dept-name', nombre);
        listContainer.appendChild(item);
    });
}

/*
 * INICIALIZACIÓN DEL SISTEMA DRAG & DROP
 * Configura SortableJS para todas las listas
 */
function initializeDragAndDrop() {
    const allDepartmentsList = document.getElementById('all-departments-list');
    const divisionLists = Array.from({length: currentDivisionCount}, (_, i) => 
        document.getElementById(`division-${i + 1}`)
    );

    // Configurar lista principal (listado de departamentos)
    Sortable.create(allDepartmentsList, {
        group: {
            name: 'departments',
            pull: 'clone',
            put: true
        },
        sort: true,
        animation: 150,
        onAdd: function(evt) {
            // Ordenar automáticamente cuando se agrega un elemento
            sortMainList();
        },
        onEnd: function(evt) {
            handleDepartmentMove(evt);
        }
    });

    // Configurar cada lista de división
    divisionLists.forEach((divisionList, index) => {
        if (divisionList) {
            Sortable.create(divisionList, {
                group: {
                    name: 'departments',
                    pull: true,
                    put: true
                },
                animation: 150,
                onEnd: function(evt) {
                    handleDepartmentMove(evt);
                }
            });
        }
    });
}

/*
 * MANEJO DE MOVIMIENTO DE DEPARTAMENTOS
 * Procesa los eventos de drag & drop entre listas
 */
function handleDepartmentMove(evt) {
    const departmentName = evt.item.getAttribute('data-dept-name');
    const toElement = evt.to;
    const fromElement = evt.from;

    // Si el destino es el listado principal
    if (toElement.id === 'all-departments-list') {
        // Eliminar de todas las divisiones y ordenar listado
        removeDepartmentFromAllDivisions(departmentName);
        sortMainList();
    } 
    // Si viene del listado principal a una división
    else if (fromElement.id === 'all-departments-list') {
        // Eliminar original y de otras divisiones
        removeDepartmentFromMainList(departmentName);
        removeDepartmentFromAllDivisions(departmentName, toElement.id);
    }
    // Si se mueve entre divisiones
    else {
        // Eliminar de otras divisiones
        removeDepartmentFromAllDivisions(departmentName, toElement.id);
    }

    // Actualizar estado y mapa
    updateDepartmentGroups();
    updateMapColors();
}

/*
 * ELIMINACIÓN DE DEPARTAMENTO DE LISTADO PRINCIPAL
 * Remueve un departamento específico del listado principal
 */
function removeDepartmentFromMainList(departmentName) {
    const allItems = document.querySelectorAll('#all-departments-list .department-item');
    allItems.forEach(item => {
        if (item.getAttribute('data-dept-name') === departmentName) {
            item.remove();
        }
    });
}

/*
 * ELIMINACIÓN DE DEPARTAMENTO DE TODAS LAS DIVISIONES
 * Remueve un departamento de todas las divisiones excepto la especificada
 */
function removeDepartmentFromAllDivisions(departmentName, exceptDivisionId = null) {
    for (let i = 1; i <= currentDivisionCount; i++) {
        const divisionId = `division-${i}`;
        if (divisionId !== exceptDivisionId) {
            const divisionList = document.getElementById(divisionId);
            if (divisionList) {
                const items = divisionList.querySelectorAll('.department-item');
                items.forEach(item => {
                    if (item.getAttribute('data-dept-name') === departmentName) {
                        item.remove();
                    }
                });
            }
        }
    }
}

/*
 * ACTUALIZACIÓN DE ESTRUCTURA DE GRUPOS
 * Sincroniza el objeto departmentGroups con el estado actual del DOM
 */
function updateDepartmentGroups() {
    Object.keys(departmentGroups).forEach(groupId => {
        departmentGroups[groupId].departments = [];
        const divisionList = document.getElementById(`division-${groupId}`);
        if (divisionList) {
            const items = divisionList.querySelectorAll('.department-item');
            items.forEach(item => {
                const deptName = item.getAttribute('data-dept-name');
                if (deptName) {
                    departmentGroups[groupId].departments.push(deptName);
                }
            });
        }
    });
}

/*
 * ACTUALIZACIÓN DE COLORES EN EL MAPA
 * Aplica los colores correspondientes a los departamentos según su división
 */
function updateMapColors() {
    if (!geoJsonLayer) return;

    geoJsonLayer.eachLayer(function(layer) {
        const deptName = layer.feature.properties.nam;
        let foundGroup = null;

        // Buscar en qué división está este departamento
        Object.keys(departmentGroups).forEach(groupId => {
            if (departmentGroups[groupId].departments.includes(deptName)) {
                foundGroup = groupId;
            }
        });

        if (foundGroup) {
            // Si está en una división: color de relleno opaco
            layer.setStyle({
                fillColor: departmentGroups[foundGroup].color,
                fillOpacity: 0.8,
                color: '#333333',
                weight: 2
            });
        } else {
            // Si no está en división: transparente (solo borde)
            layer.setStyle({
                fillColor: '#3388ff',
                fillOpacity: 0,  // Transparente
                color: '#333333',
                weight: 1,
                opacity: 0.7
            });
        }
    });
}

/*
 * ORDENAMIENTO DEL LISTADO PRINCIPAL
 * Mantiene el listado de departamentos ordenado alfabéticamente
 */
function sortMainList() {
    const listContainer = document.getElementById('all-departments-list');
    const items = Array.from(listContainer.querySelectorAll('.department-item'));
    
    // Ordenar por nombre
    items.sort((a, b) => {
        const nameA = a.getAttribute('data-dept-name').toUpperCase();
        const nameB = b.getAttribute('data-dept-name').toUpperCase();
        return nameA.localeCompare(nameB);
    });
    
    // Reconstruir lista ordenada
    listContainer.innerHTML = '';
    items.forEach(item => {
        listContainer.appendChild(item);
    });
}

/*
 * DEVOLUCIÓN DE DEPARTAMENTO AL LISTADO PRINCIPAL
 * Agrega un departamento al listado principal y lo ordena
 */
function returnDepartmentToMainList(departmentName) {
    const listContainer = document.getElementById('all-departments-list');
    
    const item = document.createElement('div');
    item.className = 'department-item';
    item.textContent = departmentName;
    item.setAttribute('data-dept-name', departmentName);
    
    listContainer.appendChild(item);
    sortMainList();
}

/*
 * CONFIGURACIÓN DEL BOTÓN DE RESET
 * Establece el event listener para el botón de reestablecimiento
 */
function setupResetButton() {
    document.getElementById('reset-btn').addEventListener('click', function() {
        resetToInitialState();
    });
}

/*
 * RESTABLECIMIENTO DEL ESTADO INICIAL
 * Devuelve toda la aplicación a su estado original
 */
function resetToInitialState() {
    // Limpiar todas las divisiones
    for (let i = 1; i <= currentDivisionCount; i++) {
        const divisionList = document.getElementById(`division-${i}`);
        if (divisionList) {
            divisionList.innerHTML = '';
        }
        departmentGroups[i] = { color: divisionColors[i-1], departments: [] };
    }

    // Restaurar listado completo
    populateDepartmentsList(allDepartments);

    // Restablecer estilo del mapa (transparente)
    geoJsonLayer.eachLayer(function(layer) {
        layer.setStyle({
            fillColor: '#3388ff',
            fillOpacity: 0,
            color: '#333333',
            weight: 1,
            opacity: 0.7
        });
    });

    // Restablecer selector a 3 divisiones
    document.getElementById('division-count').value = 3;
    initializeDivisionBoxes(3);
}

/*
 * RESALTADO DE DEPARTAMENTO
 * Función auxiliar para debugging - resalta un departamento temporalmente
 */
function highlightDepartment(deptName) {
    geoJsonLayer.eachLayer(function(layer) {
        if (layer.feature.properties.nam === deptName) {
            layer.setStyle({
                weight: 3,
                color: '#ff0000',
                fillOpacity: 0.5
            });
            
            setTimeout(() => {
                updateMapColors();
            }, 2000);
        }
    });
}
