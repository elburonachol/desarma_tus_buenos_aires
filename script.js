// Variables globales
let map;
let geoJsonLayer;
let departmentGroups = {};
let allDepartments = [];
let currentDivisionCount = 3;

// Colores para las divisiones (10 colores distintos)
const divisionColors = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', 
    '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
];

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    loadGeoJSON().then(() => {
        initializeDivisionBoxes(currentDivisionCount);
        setupResetButton();
        setupDivisionSelector();
    });
});

// Inicializar el mapa
function initializeMap() {
    map = L.map('map').setView([-36.6769, -59.8499], 7);
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
                    const nombre = feature.properties.nam || 'Sin nombre';
                    layer.bindTooltip(nombre);
                    
                    layer.on('click', function() {
                        highlightDepartment(feature.properties.nam);
                    });
                }
            }).addTo(map);

            map.fitBounds(geoJsonLayer.getBounds());
            populateDepartmentsList(filteredFeatures);
            document.getElementById('dept-count').textContent = filteredFeatures.length;
        })
        .catch(error => {
            console.error('Error cargando el GeoJSON:', error);
            alert('Error al cargar el archivo GeoJSON. Verifica la consola para más detalles.');
        });
}

// Inicializar las cajas de división
function initializeDivisionBoxes(count) {
    const container = document.getElementById('division-boxes-container');
    container.innerHTML = '';

    departmentGroups = {};

    // Guardar departamentos de divisiones que van a ser eliminadas
    if (count < currentDivisionCount) {
        for (let i = count + 1; i <= currentDivisionCount; i++) {
            const groupList = document.getElementById(`division-${i}`);
            if (groupList) {
                const items = groupList.querySelectorAll('.department-item');
                items.forEach(item => {
                    returnDepartmentToMainList(item.getAttribute('data-dept-name'));
                });
            }
        }
    }

    currentDivisionCount = count;

    for (let i = 1; i <= count; i++) {
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
    }

    initializeDragAndDrop();
}

// Configurar el selector de número de divisiones
function setupDivisionSelector() {
    const selector = document.getElementById('division-count');
    selector.value = currentDivisionCount;
    
    selector.addEventListener('change', function() {
        const newCount = parseInt(this.value);
        initializeDivisionBoxes(newCount);
        updateMapColors();
    });
}

// Llenar la lista de departamentos
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

// Inicializar drag and drop
function initializeDragAndDrop() {
    const allDepartmentsList = document.getElementById('all-departments-list');
    const divisionLists = Array.from({length: currentDivisionCount}, (_, i) => 
        document.getElementById(`division-${i + 1}`)
    );

    // Configurar Sortable para la lista principal (listado de departamentos)
    Sortable.create(allDepartmentsList, {
        group: {
            name: 'departments',
            pull: 'clone',
            put: true // Permitir arrastrar elementos de vuelta aquí
        },
        sort: true, // Permitir ordenamiento
        animation: 150,
        onAdd: function(evt) {
            // Cuando un elemento se agrega al listado principal, ordenar la lista
            sortMainList();
        },
        onEnd: function(evt) {
            handleDepartmentMove(evt);
        }
    });

    // Configurar Sortable para cada división
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

// Ordenar el listado principal alfabéticamente
function sortMainList() {
    const listContainer = document.getElementById('all-departments-list');
    const items = Array.from(listContainer.querySelectorAll('.department-item'));
    
    // Ordenar items por nombre
    items.sort((a, b) => {
        const nameA = a.getAttribute('data-dept-name').toUpperCase();
        const nameB = b.getAttribute('data-dept-name').toUpperCase();
        return nameA.localeCompare(nameB);
    });
    
    // Reconstruir la lista en orden
    listContainer.innerHTML = '';
    items.forEach(item => {
        listContainer.appendChild(item);
    });
}

// Devolver un departamento al listado principal
function returnDepartmentToMainList(departmentName) {
    const listContainer = document.getElementById('all-departments-list');
    
    // Crear el elemento
    const item = document.createElement('div');
    item.className = 'department-item';
    item.textContent = departmentName;
    item.setAttribute('data-dept-name', departmentName);
    
    // Agregar al listado
    listContainer.appendChild(item);
    
    // Ordenar el listado
    sortMainList();
}

// Manejar el movimiento de departamentos
function handleDepartmentMove(evt) {
    const departmentName = evt.item.getAttribute('data-dept-name');
    const toElement = evt.to;
    const fromElement = evt.from;

    // Si el destino es el listado principal, solo necesitamos eliminar de otras listas
    if (toElement.id === 'all-departments-list') {
        // Eliminar el departamento de todas las divisiones
        removeDepartmentFromAllDivisions(departmentName);
        // Ordenar el listado principal
        sortMainList();
    } 
    // Si viene del listado principal a una división
    else if (fromElement.id === 'all-departments-list') {
        // Eliminar el original del listado principal
        const allItems = document.querySelectorAll('#all-departments-list .department-item');
        allItems.forEach(item => {
            if (item.getAttribute('data-dept-name') === departmentName) {
                item.remove();
            }
        });
        // Eliminar de otras divisiones
        removeDepartmentFromAllDivisions(departmentName, toElement.id);
    }
    // Si se mueve entre divisiones
    else {
        // Eliminar de otras divisiones (incluyendo la de origen)
        removeDepartmentFromAllDivisions(departmentName, toElement.id);
    }

    updateDepartmentGroups();
    updateMapColors();
}

// Eliminar departamento de todas las divisiones excepto la especificada
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

// Actualizar la estructura de grupos
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

// Actualizar colores en el mapa
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

// Configurar el botón de reset
function setupResetButton() {
    document.getElementById('reset-btn').addEventListener('click', function() {
        resetToInitialState();
    });
}

// Reestablecer todo al estado inicial
function resetToInitialState() {
    // Limpiar todas las divisiones
    for (let i = 1; i <= currentDivisionCount; i++) {
        const divisionList = document.getElementById(`division-${i}`);
        if (divisionList) {
            divisionList.innerHTML = '';
        }
        departmentGroups[i].departments = [];
    }

    // Restaurar el listado completo de departamentos
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

    // Restablecer el selector a 3
    document.getElementById('division-count').value = 3;
    initializeDivisionBoxes(3);
}

// Resaltar departamento
function highlightDepartment(deptName) {
    geoJsonLayer.eachLayer(function(layer) {
        if (layer.feature.properties.nam === deptName) {
            layer.setStyle({
                weight: 3,
                color: '#ff0000',
                fillOpacity: 0.9
            });
            
            setTimeout(() => {
                updateMapColors();
            }, 2000);
        }
    });
}
