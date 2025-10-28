// Variables globales
let map;
let geoJsonLayer;
let departmentGroups = {
    1: { color: '#ff6b6b', departments: [] },
    2: { color: '#4ecdc4', departments: [] },
    3: { color: '#45b7d1', departments: [] }
};

// Nueva variable para almacenar todos los departamentos ordenados
let allDepartments = [];

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    loadGeoJSON().then(() => {
        initializeDragAndDrop();
        setupResetButton();
    });
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
    return fetch('partidos.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar el archivo GeoJSON');
            }
            return response.json();
        })
        .then(data => {
            // Filtrar features que tienen valor en "arl"
            const filteredFeatures = data.features.filter(feature => 
                feature.properties.arl !== null && 
                feature.properties.arl !== undefined && 
                feature.properties.arl !== ''
            );

            console.log(`Departamentos cargados: ${filteredFeatures.length}`);
            console.log('Primeros 5 departamentos:', filteredFeatures.slice(0, 5).map(f => f.properties.nam));

            // Ordenar alfabéticamente por el campo "nam"
            filteredFeatures.sort((a, b) => {
                const nameA = (a.properties.nam || '').toUpperCase();
                const nameB = (b.properties.nam || '').toUpperCase();
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
            
            // Actualizar contador
            document.getElementById('dept-count').textContent = filteredFeatures.length;
        })
        .catch(error => {
            console.error('Error cargando el GeoJSON:', error);
            alert('Error al cargar el archivo GeoJSON. Verifica la consola para más detalles.');
        });
}

// Llenar la lista de departamentos
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

// Inicializar drag and drop
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
            // Solo procesar si el movimiento fue exitoso (a otra lista)
            if (evt.to !== evt.from) {
                handleDepartmentMove(evt);
            }
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
                // Solo procesar si el movimiento fue exitoso
                if (evt.to !== evt.from) {
                    handleDepartmentMove(evt);
                }
            }
        });
    });
}

// Manejar el movimiento de departamentos
function handleDepartmentMove(evt) {
    const departmentName = evt.item.getAttribute('data-dept-name');
    const toGroup = evt.to.id;
    const fromGroup = evt.from.id;

    console.log(`Moviendo ${departmentName} desde ${fromGroup} a ${toGroup}`);

    // Si viene de la lista principal, eliminar el original
    if (fromGroup === 'all-departments-list') {
        // Buscar y eliminar el elemento original de la lista principal
        const allItems = document.querySelectorAll('#all-departments-list .department-item');
        allItems.forEach(item => {
            if (item.getAttribute('data-dept-name') === departmentName) {
                item.remove();
            }
        });
    }

    // Eliminar el departamento de todas las demás listas
    removeDepartmentFromAllLists(departmentName, toGroup);

    // Actualizar grupos y colores
    updateDepartmentGroups();
    updateMapColors();
}

// Eliminar departamento de todas las listas excepto la de destino
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

    console.log('Grupos actualizados:', departmentGroups);
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

// Configurar el botón de reset
function setupResetButton() {
    document.getElementById('reset-btn').addEventListener('click', function() {
        resetToInitialState();
    });
}

// Reestablecer todo al estado inicial
function resetToInitialState() {
    console.log('Reestableciendo a estado inicial...');
    
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

    console.log('Estado reestablecido correctamente');
}

// Resaltar departamento
function highlightDepartment(deptName) {
    console.log('Departamento clickeado:', deptName);
    
    // Encontrar el layer y resaltarlo temporalmente
    geoJsonLayer.eachLayer(function(layer) {
        if (layer.feature.properties.nam === deptName) {
            layer.setStyle({
                weight: 3,
                color: '#ff0000',
                fillOpacity: 0.9
            });
            
            // Revertir después de 2 segundos
            setTimeout(() => {
                updateMapColors();
            }, 2000);
        }
    });
}
