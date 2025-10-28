// Variables globales
let map;
let geoJsonLayer;
let departmentGroups = {
    1: { color: '#ff6b6b', departments: [] },
    2: { color: '#4ecdc4', departments: [] },
    3: { color: '#45b7d1', departments: [] }
};

// Colores para los grupos (puedes agregar más)
const groupColors = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', 
    '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
];

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeDragAndDrop();
    loadGeoJSON();
});

// Inicializar el mapa
function initializeMap() {
    // Centrar en Provincia de Buenos Aires
    map = L.map('map').setView([-36.6769, -59.8499], 7);

    // Capa base de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

// Cargar el GeoJSON
function loadGeoJSON() {
    fetch('partidos.geojson')
        .then(response => response.json())
        .then(data => {
            // Filtrar features que tienen valor en "arl"
            const filteredFeatures = data.features.filter(feature => 
                feature.properties.arl !== null && feature.properties.arl !== undefined
            );

            // Crear capa GeoJSON
            geoJsonLayer = L.geoJSON(filteredFeatures, {
                style: function(feature) {
                    return {
                        fillColor: '#3388ff',
                        fillOpacity: 0.7,
                        color: 'white',
                        weight: 1,
                        opacity: 0.5
                    };
                },
                onEachFeature: function(feature, layer) {
                    // Agregar tooltip con el nombre
                    const nombre = feature.properties.nam || 'Sin nombre';
                    layer.bindTooltip(nombre);
                    
                    // Al hacer click, resaltar el departamento
                    layer.on('click', function() {
                        highlightDepartment(feature.properties.nam);
                    });
                }
            }).addTo(map);

            // Ajustar el mapa a los límites de la capa
            map.fitBounds(geoJsonLayer.getBounds());

            // Llenar la lista de todos los departamentos
            populateDepartmentsList(filteredFeatures);
        })
        .catch(error => console.error('Error cargando el GeoJSON:', error));
}

// Llenar la lista de departamentos
function populateDepartmentsList(features) {
    const listContainer = document.getElementById('all-departments-list');
    
    features.forEach(feature => {
        const nombre = feature.properties.nam;
        const item = document.createElement('div');
        item.className = 'department-item';
        item.textContent = nombre;
        item.setAttribute('data-dept-name', nombre);
        listContainer.appendChild(item);
    });
}

// Inicializar drag and drop
function initializeDragAndDrop() {
    // Hacer todas las listas arrastrables
    const allDepartmentsList = document.getElementById('all-departments-list');
    const groupLists = [
        document.getElementById('group-1'),
        document.getElementById('group-2'),
        document.getElementById('group-3')
    ];

    // Configurar Sortable para la lista principal
    Sortable.create(allDepartmentsList, {
        group: {
            name: 'departments',
            pull: 'clone',
            put: true
        },
        sort: false,
        animation: 150,
        onEnd: function(evt) {
            handleDepartmentMove(evt);
        }
    });

    // Configurar Sortable para cada grupo
    groupLists.forEach((groupList, index) => {
        Sortable.create(groupList, {
            group: 'departments',
            animation: 150,
            onEnd: function(evt) {
                handleDepartmentMove(evt);
            }
        });
    });
}

// Manejar el movimiento de departamentos
function handleDepartmentMove(evt) {
    const departmentName = evt.item.getAttribute('data-dept-name');
    const fromGroup = evt.from.id;
    const toGroup = evt.to.id;

    // Si se mueve desde "all-departments-list", es un nuevo departamento
    if (fromGroup === 'all-departments-list') {
        // El elemento original se queda, el clon va al grupo
        // No necesitamos hacer nada con el original
    }

    // Actualizar grupos y colores
    updateDepartmentGroups();
    updateMapColors();
}

// Actualizar la estructura de grupos
function updateDepartmentGroups() {
    // Reiniciar grupos
    Object.keys(departmentGroups).forEach(groupId => {
        departmentGroups[groupId].departments = [];
    });

    // Llenar con los departamentos actuales en cada grupo
    Object.keys(departmentGroups).forEach(groupId => {
        const groupList = document.getElementById(`group-${groupId}`);
        const items = groupList.querySelectorAll('.department-item');
        
        items.forEach(item => {
            const deptName = item.getAttribute('data-dept-name');
            if (deptName && !departmentGroups[groupId].departments.includes(deptName)) {
                departmentGroups[groupId].departments.push(deptName);
            }
        });
    });
}

// Actualizar colores en el mapa
function updateMapColors() {
    if (!geoJsonLayer) return;

    geoJsonLayer.eachLayer(function(layer) {
        const deptName = layer.feature.properties.nam;
        let foundGroup = null;

        // Buscar en qué grupo está este departamento
        Object.keys(departmentGroups).forEach(groupId => {
            if (departmentGroups[groupId].departments.includes(deptName)) {
                foundGroup = groupId;
            }
        });

        // Aplicar color según el grupo
        if (foundGroup) {
            layer.setStyle({
                fillColor: departmentGroups[foundGroup].color,
                fillOpacity: 0.8,
                color: 'white',
                weight: 2
            });
        } else {
            // Color por defecto si no está en ningún grupo
            layer.setStyle({
                fillColor: '#3388ff',
                fillOpacity: 0.3,
                color: 'white',
                weight: 1
            });
        }
    });
}

// Resaltar departamento (para debugging)
function highlightDepartment(deptName) {
    console.log('Departamento clickeado:', deptName);
}