// Variables globales (sin cambios)
let map;
let geoJsonLayer;
let departmentGroups = {
    1: { color: '#ff6b6b', departments: [] },
    2: { color: '#4ecdc4', departments: [] },
    3: { color: '#45b7d1', departments: [] }
};

// Nueva variable para almacenar todos los departamentos ordenados
let allDepartments = [];

// Inicialización (modificada)
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    loadGeoJSON().then(() => {
        initializeDragAndDrop();
        setupResetButton();
    });
});

// Cargar el GeoJSON (modificada)
function loadGeoJSON() {
    return fetch('partidos.geojson')
        .then(response => response.json())
        .then(data => {
            // Filtrar features que tienen valor en "arl"
            const filteredFeatures = data.features.filter(feature => 
                feature.properties.arl !== null && feature.properties.arl !== undefined
            );

            // Ordenar alfabéticamente por el campo "nam"
            filteredFeatures.sort((a, b) => {
                const nameA = a.properties.nam.toUpperCase();
                const nameB = b.properties.nam.toUpperCase();
                return nameA.localeCompare(nameB);
            });

            // Guardar referencia a todos los departamentos
            allDepartments = filteredFeatures;

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
                    const nombre = feature.properties.nam || 'Sin nombre';
                    layer.bindTooltip(nombre);
                    
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

// Llenar la lista de departamentos (modificada)
function populateDepartmentsList(features) {
    const listContainer = document.getElementById('all-departments-list');
    listContainer.innerHTML = ''; // Limpiar lista existente
    
    features.forEach(feature => {
        const nombre = feature.properties.nam;
        const item = document.createElement('div');
        item.className = 'department-item';
        item.textContent = nombre;
        item.setAttribute('data-dept-name', nombre);
        listContainer.appendChild(item);
    });
}

// Inicializar drag and drop (modificada)
function initializeDragAndDrop() {
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
            put: false // No permitir arrastrar elementos de vuelta a esta lista
        },
        sort: false,
        animation: 150,
        onEnd: function(evt) {
            // Eliminar el elemento original de la lista principal
            if (evt.from === allDepartmentsList) {
                evt.item.remove();
            }
            handleDepartmentMove(evt);
        }
    });

    // Configurar Sortable para cada grupo
    groupLists.forEach((groupList, index) => {
        Sortable.create(groupList, {
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
    });
}

// Manejar el movimiento de departamentos (MODIFICADA COMPLETAMENTE)
function handleDepartmentMove(evt) {
    const departmentName = evt.item.getAttribute('data-dept-name');
    const toGroup = evt.to.id;
    const fromGroup = evt.from.id;

    // Si el departamento viene de la lista principal, crear un nuevo elemento
    if (fromGroup === 'all-departments-list') {
        const newItem = document.createElement('div');
        newItem.className = 'department-item';
        newItem.textContent = departmentName;
        newItem.setAttribute('data-dept-name', departmentName);
        evt.item.replaceWith(newItem);
    }

    // Eliminar el departamento de todas las demás listas
    removeDepartmentFromAllLists(departmentName, toGroup);

    // Actualizar grupos y colores
    updateDepartmentGroups();
    updateMapColors();
}

// NUEVA FUNCIÓN: Eliminar departamento de todas las listas excepto la de destino
function removeDepartmentFromAllLists(departmentName, targetListId) {
    const allLists = [
        'all-departments-list',
        'group-1', 
        'group-2',
        'group-3'
    ];

    allLists.forEach(listId => {
        if (listId !== targetListId) {
            const list = document.getElementById(listId);
            const items = list.querySelectorAll('.department-item');
            items.forEach(item => {
                if (item.getAttribute('data-dept-name') === departmentName) {
                    item.remove();
                }
            });
        }
    });
}

// NUEVA FUNCIÓN: Configurar el botón de reset
function setupResetButton() {
    document.getElementById('reset-btn').addEventListener('click', function() {
        resetToInitialState();
    });
}

// NUEVA FUNCIÓN: Reestablecer todo al estado inicial
function resetToInitialState() {
    // Limpiar todos los grupos
    Object.keys(departmentGroups).forEach(groupId => {
        const groupList = document.getElementById(`group-${groupId}`);
        groupList.innerHTML = '';
        departmentGroups[groupId].departments = [];
    });

    // Restaurar la lista completa de departamentos
    populateDepartmentsList(allDepartments);

    // Restablecer colores del mapa
    geoJsonLayer.eachLayer(function(layer) {
        layer.setStyle({
            fillColor: '#3388ff',
            fillOpacity: 0.7,
            color: 'white',
            weight: 1,
            opacity: 0.5
        });
    });
}

// Las funciones updateDepartmentGroups() y updateMapColors() se mantienen igual
function updateDepartmentGroups() {
    Object.keys(departmentGroups).forEach(groupId => {
        departmentGroups[groupId].departments = [];
        const groupList = document.getElementById(`group-${groupId}`);
        const items = groupList.querySelectorAll('.department-item');
        
        items.forEach(item => {
            const deptName = item.getAttribute('data-dept-name');
            if (deptName) {
                departmentGroups[groupId].departments.push(deptName);
            }
        });
    });
}

function updateMapColors() {
    if (!geoJsonLayer) return;

    geoJsonLayer.eachLayer(function(layer) {
        const deptName = layer.feature.properties.nam;
        let foundGroup = null;

        Object.keys(departmentGroups).forEach(groupId => {
            if (departmentGroups[groupId].departments.includes(deptName)) {
                foundGroup = groupId;
            }
        });

        if (foundGroup) {
            layer.setStyle({
                fillColor: departmentGroups[foundGroup].color,
                fillOpacity: 0.8,
                color: 'white',
                weight: 2
            });
        } else {
            layer.setStyle({
                fillColor: '#3388ff',
                fillOpacity: 0.3,
                color: 'white',
                weight: 1
            });
        }
    });
}
