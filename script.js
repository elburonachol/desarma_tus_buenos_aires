/*
 * MAPA INTERACTIVO - DIVISIÓN DE LA PROVINCIA DE BUENOS AIRES
 * 
 * FUNCIONALIDADES PRINCIPALES:
 * 1. Carga y visualización de mapa con capa base oficial de Argentina (IGN) en escala de grises
 * 2. Representación correcta de la soberanía argentina en Malvinas
 * 3. Carga de departamentos desde PBA.geojson con campos "cde" y "nam"
 * 4. Sistema de divisiones con paleta de colores armónica (12 colores)
 * 5. Drag & drop de departamentos entre listado y divisiones
 * 6. Control dinámico del número de divisiones (1-12)
 * 7. Reset completo del estado
 * 8. Departamentos sin color cuando están en el listado, con color cuando están en divisiones
 * 9. Distribución en tres columnas: mapa | divisiones | listado
 * 10. Tabla comparativa que muestra cantidad de partidos, superficie, población y densidad
 * 11. Contador de departamentos restantes en listado
 * 12. Destacado visual de departamentos del Gran Buenos Aires (texto en negrita)
 * 13. Integración con datos externos de superficie y población
 * 14. Nombres de divisiones editables por el usuario
 * 15. Carga de regiones existentes (secciones electorales y regiones sanitarias)
 * 16. Selección por polígono de múltiples departamentos
 */

// Variables globales para el estado de la aplicación
let map;                    // Instancia del mapa Leaflet
let geoJsonLayer;           // Capa GeoJSON con los departamentos
let departmentGroups = {};  // Objeto que almacena las divisiones y sus departamentos
let allDepartments = [];    // Array con todos los departamentos (para reset)
let currentDivisionCount = 3; // Número actual de divisiones visibles
let partidosData = null;    // Datos cargados desde datos_partidos.json
let regionesExistentes = null; // Datos cargados desde regiones_existentes.json
let currentRegionType = null; // Tipo de región actualmente cargada (null, 'secciones_electorales', 'regiones_sanitarias')

// Variables para la funcionalidad de polígono
let polygonMode = false;    // Indica si estamos en modo de dibujo de polígono
let polygonPoints = [];     // Almacena los puntos del polígono en construcción
let polygonLayer = null;    // Capa del polígono actual
let polylineLayer = null;   // Capa de la línea actual
let selectedDepartments = []; // Departamentos seleccionados por el polígono
let selectedDepartmentsSet = new Set(); // Para manejar departamentos seleccionados
let pointMarkers = []; // Para los marcadores de puntos

// Paleta de colores armónica y bien diferenciable para las divisiones (12 colores)
const divisionColors = [
    '#1f77b4', // Azul
    '#ff7f0e', // Naranja
    '#2ca02c', // Verde
    '#d62728', // Rojo
    '#9467bd', // Violeta
    '#8c564b', // Marrón
    '#e377c2', // Rosa
    '#7f7f7f', // Gris
    '#bcbd22', // Oliva
    '#17becf', // Cyan
    '#9edae5', // Azul claro
    '#ff9896'  // Rosa claro
];

// Códigos de departamentos que pertenecen al Gran Buenos Aires
const gbaCodes = [
    '06028', '06035', '06091', '06260', '06270', '06274', 
    '06371', '06408', '06410', '06412', '06427', '06434', 
    '06490', '06515', '06539', '06560', '06568', '06658', 
    '06749', '06756', '06760', '06805', '06840', '06861'
];

/*
 * INICIALIZACIÓN DE LA APLICACIÓN
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    
    Promise.all([
        loadGeoJSON(),
        loadPartidosData(),
        loadRegionesExistentes()
    ]).then(() => {
        initializeDivisionBoxes(currentDivisionCount);
        setupResetButton();
        setupDivisionSelector();
        setupRegionSelector();
        setupPolygonButton();
        initializeComparisonTable();
        updateRemainingCount();
    }).catch(error => {
        console.error('Error en la inicialización:', error);
    });
});

/*
 * CONFIGURACIÓN DEL BOTÓN DE POLÍGONO
 */
function setupPolygonButton() {
    const polygonBtn = document.getElementById('polygon-btn');
    
    polygonBtn.addEventListener('click', function() {
        if (polygonMode) {
            deactivatePolygonMode();
        } else {
            activatePolygonMode();
        }
    });
}

/*
 * ACTIVACIÓN DEL MODO POLÍGONO
 */
function activatePolygonMode() {
    polygonMode = true;
    polygonPoints = [];
    selectedDepartments = [];
    selectedDepartmentsSet.clear();
    
    document.getElementById('polygon-btn').classList.add('active');
    document.getElementById('polygon-info').style.display = 'block';
    
    map.getContainer().style.cursor = 'crosshair';
    
    map.on('click', handleMapClick);
    map.on('contextmenu', handleMapRightClick);
    
    console.log('Modo polígono activado');
}

/*
 * DESACTIVACIÓN DEL MODO POLÍGONO
 */
function deactivatePolygonMode() {
    polygonMode = false;
    
    document.getElementById('polygon-btn').classList.remove('active');
    document.getElementById('polygon-info').style.display = 'none';
    map.getContainer().style.cursor = '';
    
    if (polygonLayer) {
        map.removeLayer(polygonLayer);
        polygonLayer = null;
    }
    if (polylineLayer) {
        map.removeLayer(polylineLayer);
        polylineLayer = null;
    }
    
    pointMarkers.forEach(marker => map.removeLayer(marker));
    pointMarkers = [];
    
    map.off('click', handleMapClick);
    map.off('contextmenu', handleMapRightClick);
    
    console.log('Modo polígono desactivado');
}

/*
 * MANEJO DE CLICK IZQUIERDO EN EL MAPA (MODO POLÍGONO)
 */
function handleMapClick(e) {
    if (!polygonMode) return;
    
    polygonPoints.push(e.latlng);
    
    const marker = L.circleMarker(e.latlng, {
        radius: 6,
        fillColor: '#e74c3c',
        color: '#c0392b',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map);
    pointMarkers.push(marker);
    
    drawPolygon();
    
    if (polygonPoints.length >= 2) {
        drawPolyline();
    }
    
    if (polygonPoints.length >= 100) {
        finalizePolygon();
    }
}

/*
 * MANEJO DE CLICK DERECHO EN EL MAPA (MODO POLÍGONO)
 */
function handleMapRightClick(e) {
    if (!polygonMode || polygonPoints.length < 3) return;
    
    e.originalEvent.preventDefault();
    finalizePolygon();
}

/*
 * DIBUJO DEL POLÍGONO
 */
function drawPolygon() {
    if (polygonLayer) {
        map.removeLayer(polygonLayer);
    }
    
    if (polygonPoints.length >= 3) {
        polygonLayer = L.polygon(polygonPoints, {
            color: '#3498db',
            weight: 2,
            fillColor: '#3498db',
            fillOpacity: 0.2
        }).addTo(map);
    }
}

/*
 * DIBUJO DE LA LÍNEA
 */
function drawPolyline() {
    if (polylineLayer) {
        map.removeLayer(polylineLayer);
    }
    
    polylineLayer = L.polyline(polygonPoints, {
        color: '#e74c3c',
        weight: 2,
        opacity: 0.8,
        dashArray: '5, 10'
    }).addTo(map);
}

/*
 * FINALIZACIÓN DEL POLÍGONO
 */
function finalizePolygon() {
    if (polygonPoints.length < 3) {
        alert('Se necesitan al menos 3 puntos para crear un polígono válido');
        return;
    }
    
    const polygon = L.polygon(polygonPoints);
    selectedDepartments = [];
    selectedDepartmentsSet.clear();
    
    geoJsonLayer.eachLayer(function(layer) {
        if (polygon.getBounds().intersects(layer.getBounds())) {
            const center = layer.getBounds().getCenter();
            if (polygon.getBounds().contains(center)) {
                const deptName = layer.feature.properties.nam;
                selectedDepartments.push(deptName);
                selectedDepartmentsSet.add(deptName);
            }
        }
    });
    
    if (selectedDepartments.length > 0) {
        highlightSelectedDepartments();
        moveSelectedToMainList();
        markSelectedInDivisions();
        alert(`Se seleccionaron ${selectedDepartments.length} departamentos`);
    } else {
        alert('No se encontraron departamentos dentro del polígono');
    }
    
    deactivatePolygonMode();
}

/*
 * MARCADO DE SELECCIONADOS EN DIVISIONES
 */
function markSelectedInDivisions() {
    for (let i = 1; i <= currentDivisionCount; i++) {
        const divisionList = document.getElementById(`division-${i}`);
        if (divisionList) {
            const items = divisionList.querySelectorAll('.department-item');
            items.forEach(item => {
                const deptName = item.getAttribute('data-dept-name');
                if (selectedDepartmentsSet.has(deptName)) {
                    item.classList.add('selected');
                    divisionList.insertBefore(item, divisionList.firstChild);
                }
            });
        }
    }
}

/*
 * RESALTADO DE DEPARTAMENTOS SELECCIONADOS
 */
function highlightSelectedDepartments() {
    geoJsonLayer.eachLayer(function(layer) {
        const deptName = layer.feature.properties.nam;
        if (selectedDepartmentsSet.has(deptName)) {
            layer.setStyle({
                fillColor: '#f39c12',
                fillOpacity: 0.7,
                color: '#e67e22',
                weight: 3
            });
        }
    });
}

/*
 * MOVIMIENTO DE DEPARTAMENTOS SELECCIONADOS AL LISTADO PRINCIPAL
 */
function moveSelectedToMainList() {
    const listContainer = document.getElementById('all-departments-list');
    
    const previouslySelected = document.querySelectorAll('.department-item.selected');
    previouslySelected.forEach(item => {
        item.classList.remove('selected');
    });
    
    selectedDepartments.forEach(deptName => {
        const existingItems = listContainer.querySelectorAll('.department-item');
        let existingItem = null;
        
        existingItems.forEach(item => {
            if (item.getAttribute('data-dept-name') === deptName) {
                existingItem = item;
            }
        });
        
        if (existingItem) {
            listContainer.insertBefore(existingItem, listContainer.firstChild);
            existingItem.classList.add('selected');
        } else {
            const dept = allDepartments.find(d => d.properties.nam === deptName);
            const isGBA = dept && gbaCodes.includes(dept.properties.cde);
            
            const item = document.createElement('div');
            item.className = `department-item ${isGBA ? 'gba-department-bold' : ''} selected`;
            item.textContent = deptName;
            item.setAttribute('data-dept-name', deptName);
            item.setAttribute('data-dept-code', dept ? dept.properties.cde : '');
            
            listContainer.insertBefore(item, listContainer.firstChild);
        }
    });
    
    updateRemainingCount();
}

/*
 * CARGA DE DATOS DE REGIONES EXISTENTES
 */
async function loadRegionesExistentes() {
    try {
        const response = await fetch('regiones/regiones_existentes.json');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        regionesExistentes = await response.json();
        return true;
    } catch (error) {
        console.error('Error cargando datos de regiones existentes:', error);
        return true;
    }
}

/*
 * CONFIGURACIÓN DEL SELECTOR DE REGIONES EXISTENTES
 */
function setupRegionSelector() {
    const selector = document.getElementById('existing-regions');
    
    selector.addEventListener('change', function() {
        const selectedOption = this.value;
        if (selectedOption) {
            loadExistingRegions(selectedOption);
        } else {
            currentRegionType = null;
        }
    });
}

/*
 * CARGA DE REGIONES EXISTENTES EN LAS DIVISIONES
 */
function loadExistingRegions(tipoRegion) {
    if (!regionesExistentes) {
        console.error('No se cargaron los datos de regiones existentes');
        return;
    }

    const regiones = regionesExistentes[tipoRegion];
    if (!regiones) {
        console.error(`Tipo de región no válido: ${tipoRegion}`);
        return;
    }

    currentRegionType = tipoRegion;
    const nombresRegiones = Object.keys(regiones).sort();
    const numeroRegiones = nombresRegiones.length;

    document.getElementById('division-count').value = numeroRegiones;
    initializeDivisionBoxes(numeroRegiones);

    const listContainer = document.getElementById('all-departments-list');
    listContainer.innerHTML = '';

    nombresRegiones.forEach((nombreRegion, index) => {
        const groupId = index + 1;
        const departamentosRegion = regiones[nombreRegion];

        departmentGroups[groupId].name = nombreRegion;
        const editableName = document.querySelector(`[data-group-id="${groupId}"] .editable-division-name`);
        if (editableName) {
            editableName.textContent = nombreRegion;
        }

        const divisionList = document.getElementById(`division-${groupId}`);
        if (divisionList) {
            divisionList.innerHTML = '';

            departamentosRegion.forEach(depto => {
                const codigoCde = depto.cde;
                const nombreDepartamento = depto.municipio_nombre;
                const isGBA = gbaCodes.includes(codigoCde);

                const item = document.createElement('div');
                item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
                item.textContent = nombreDepartamento;
                item.setAttribute('data-dept-name', nombreDepartamento);
                item.setAttribute('data-dept-code', codigoCde);
                divisionList.appendChild(item);
            });
        }
    });

    updateDepartmentGroups();
    updateMapColors();
    updateComparisonTable();
    updateRemainingCount();
}

/*
 * CARGA DE DATOS DE PARTIDOS
 */
async function loadPartidosData() {
    try {
        const response = await fetch('datos/datos_partidos.json');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        partidosData = await response.json();
        return true;
    } catch (error) {
        console.error('Error cargando datos de partidos:', error);
        return true;
    }
}

/*
 * INICIALIZACIÓN DEL MAPA LEAFLET
 */
function initializeMap() {
    map = L.map('map').setView([-36.6769, -59.8499], 7);

    L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
        attribution: '<a href="http://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | <a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">Instituto Geográfico Nacional</a>',
        minZoom: 3,
        maxZoom: 18
    }).addTo(map);
}

/*
 * CARGA DEL ARCHIVO GEOJSON PBA.geojson
 */
function loadGeoJSON() {
    return fetch('PBA.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar el archivo GeoJSON');
            }
            return response.json();
        })
        .then(data => {
            const allFeatures = data.features;

            console.log(`Departamentos cargados: ${allFeatures.length}`);

            allFeatures.sort((a, b) => {
                const nameA = (a.properties.nam || '').toUpperCase();
                const nameB = (b.properties.nam || '').toUpperCase();
                return nameA.localeCompare(nameB);
            });

            allDepartments = allFeatures;

            geoJsonLayer = L.geoJSON(allFeatures, {
                style: function(feature) {
                    const isGBA = gbaCodes.includes(feature.properties.cde);
                    const isSelected = selectedDepartmentsSet.has(feature.properties.nam);
                    
                    if (isSelected) {
                        return {
                            fillColor: '#f39c12',
                            fillOpacity: 0.7,
                            color: '#e67e22',
                            weight: 3,
                            opacity: 1
                        };
                    } else {
                        return {
                            fillColor: '#3388ff',
                            fillOpacity: 0,
                            color: '#2c3e50',
                            weight: isGBA ? 1.5 : 0.8,
                            opacity: 0.8
                        };
                    }
                },
                onEachFeature: function(feature, layer) {
                    const nombre = feature.properties.nam || 'Sin nombre';
                    
                    layer.bindTooltip(`<strong>${nombre}</strong>`, {
                        permanent: false,
                        direction: 'auto'
                    });
                    
                    layer.on('click', function() {
                        highlightDepartment(feature.properties.nam);
                    });

                    layer.on('mouseover', function() {
                        const deptName = feature.properties.nam;
                        if (!selectedDepartmentsSet.has(deptName)) {
                            layer.setStyle({
                                weight: 2,
                                color: '#e74c3c',
                                fillOpacity: 0.1
                            });
                        }
                    });

                    layer.on('mouseout', function() {
                        const deptName = feature.properties.nam;
                        const isGBA = gbaCodes.includes(feature.properties.cde);
                        const inDivision = isDepartmentInDivision(deptName);
                        
                        if (selectedDepartmentsSet.has(deptName)) {
                            layer.setStyle({
                                fillColor: '#f39c12',
                                fillOpacity: 0.7,
                                color: '#e67e22',
                                weight: 3
                            });
                        } else if (inDivision) {
                            const groupId = getDepartmentGroupId(deptName);
                            layer.setStyle({
                                fillColor: departmentGroups[groupId].color,
                                fillOpacity: 0.8,
                                color: 'white',
                                weight: 1.5
                            });
                        } else {
                            layer.setStyle({
                                fillColor: '#3388ff',
                                fillOpacity: 0,
                                color: '#2c3e50',
                                weight: isGBA ? 1.5 : 0.8,
                                opacity: 0.8
                            });
                        }
                    });
                }
            }).addTo(map);

            setTimeout(() => {
                map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });
            }, 100);
            
            populateDepartmentsList(allFeatures);
            document.getElementById('dept-count').textContent = allFeatures.length;
        })
        .catch(error => {
            console.error('Error cargando el GeoJSON:', error);
            alert('Error al cargar el archivo GeoJSON. Verifica la consola para más detalles.');
        });
}

/*
 * ACTUALIZACIÓN DEL CONTADOR DE DEPARTAMENTOS RESTANTES
 */
function updateRemainingCount() {
    const listContainer = document.getElementById('all-departments-list');
    const remainingCount = listContainer.querySelectorAll('.department-item').length;
    document.getElementById('dept-remaining-count').textContent = remainingCount;
}

/*
 * INICIALIZACIÓN DE CAJAS DE DIVISIÓN
 */
function initializeDivisionBoxes(newCount) {
    const container = document.getElementById('division-boxes-container');
    
    const previousGroups = JSON.parse(JSON.stringify(departmentGroups));
    
    if (newCount < currentDivisionCount) {
        processDivisionReduction(newCount, previousGroups);
    }
    
    currentDivisionCount = newCount;
    container.innerHTML = '';
    departmentGroups = {};
    
    for (let i = 1; i <= newCount; i++) {
        const color = divisionColors[i - 1] || '#3388ff';
        const defaultName = `División ${i}`;
        departmentGroups[i] = { 
            color: color, 
            departments: [],
            name: defaultName
        };

        const groupBox = document.createElement('div');
        groupBox.className = 'group-box';
        groupBox.setAttribute('data-group-id', i);
        groupBox.style.borderLeft = `4px solid ${color}`;

        groupBox.innerHTML = `
            <h3 class="editable-division-name" contenteditable="true">${defaultName}</h3>
            <div class="group-list" id="division-${i}"></div>
        `;

        container.appendChild(groupBox);
        
        const editableName = groupBox.querySelector('.editable-division-name');
        editableName.addEventListener('blur', function() {
            departmentGroups[i].name = this.textContent;
            updateComparisonTable();
            if (currentRegionType) {
                document.getElementById('existing-regions').value = '';
                currentRegionType = null;
            }
        });
        
        editableName.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.blur();
            }
        });
        
        if (previousGroups[i] && previousGroups[i].departments) {
            const divisionList = document.getElementById(`division-${i}`);
            previousGroups[i].departments.forEach(deptName => {
                const dept = allDepartments.find(d => d.properties.nam === deptName);
                const isGBA = dept && gbaCodes.includes(dept.properties.cde);
                
                const item = document.createElement('div');
                item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
                item.textContent = deptName;
                item.setAttribute('data-dept-name', deptName);
                divisionList.appendChild(item);
            });
        }
    }

    initializeDragAndDrop();
    updateDepartmentGroups();
    updateMapColors();
    updateComparisonTable();
    updateRemainingCount();
}

/*
 * INICIALIZACIÓN DE LA TABLA COMPARATIVA
 */
function initializeComparisonTable() {
    updateComparisonTable();
}

/*
 * OBTENER CÓDIGO CDE POR NOMBRE DE DEPARTAMENTO
 */
function obtenerCodigoCdePorNombre(nombreDepartamento) {
    const departamento = allDepartments.find(dept => dept.properties.nam === nombreDepartamento);
    return departamento ? departamento.properties.cde : null;
}

/*
 * CALCULAR TOTAL DE UNA VARIABLE PARA UNA DIVISIÓN
 */
function calcularTotalDivision(grupoId, variable) {
    if (!partidosData || !partidosData.datos) {
        return 0;
    }
    
    const partidosEnGrupo = departmentGroups[grupoId].departments;
    let total = 0;
    let partidosConDatos = 0;
    
    partidosEnGrupo.forEach(nombrePartido => {
        const codigoCde = obtenerCodigoCdePorNombre(nombrePartido);
        if (codigoCde && partidosData.datos[codigoCde] && partidosData.datos[codigoCde][variable]) {
            total += partidosData.datos[codigoCde][variable];
            partidosConDatos++;
        }
    });
    
    return partidosConDatos > 0 ? total : 0;
}

/*
 * CALCULAR DENSIDAD POBLACIONAL PARA UNA DIVISIÓN
 */
function calcularDensidadDivision(grupoId) {
    const poblacion = calcularTotalDivision(grupoId, 'poblacion_total');
    const superficie = calcularTotalDivision(grupoId, 'superficie');
    
    if (superficie > 0 && poblacion > 0) {
        return (poblacion / superficie).toFixed(1);
    }
    return '0.0';
}

/*
 * FORMATEAR NÚMERO CON SEPARADORES DE MILES
 */
function formatearNumero(numero) {
    if (numero === 0 || numero === '0') return '0';
    if (!numero) return '-';
    
    return numero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/*
 * ACTUALIZACIÓN DE LA TABLA COMPARATIVA
 */
function updateComparisonTable() {
    const table = document.getElementById('comparison-table');
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');
    
    thead.innerHTML = '<th>Variable</th>';
    tbody.innerHTML = '';
    
    for (let i = 1; i <= currentDivisionCount; i++) {
        const th = document.createElement('th');
        th.textContent = departmentGroups[i] ? departmentGroups[i].name : `División ${i}`;
        th.style.backgroundColor = departmentGroups[i] ? departmentGroups[i].color : '#f8f9fa';
        th.style.color = getContrastColor(departmentGroups[i] ? departmentGroups[i].color : '#f8f9fa');
        thead.appendChild(th);
    }
    
    const filaCantidad = document.createElement('tr');
    const celdaVariableCantidad = document.createElement('td');
    celdaVariableCantidad.textContent = 'Cantidad de partidos';
    filaCantidad.appendChild(celdaVariableCantidad);
    
    for (let i = 1; i <= currentDivisionCount; i++) {
        const countCell = document.createElement('td');
        const count = departmentGroups[i] ? departmentGroups[i].departments.length : 0;
        countCell.textContent = count;
        filaCantidad.appendChild(countCell);
    }
    
    tbody.appendChild(filaCantidad);
    
    if (partidosData && partidosData.datos) {
        const filaSuperficie = document.createElement('tr');
        const celdaVariableSuperficie = document.createElement('td');
        celdaVariableSuperficie.textContent = 'Superficie total (km²)';
        filaSuperficie.appendChild(celdaVariableSuperficie);
        
        for (let i = 1; i <= currentDivisionCount; i++) {
            const superficieCell = document.createElement('td');
            const superficie = calcularTotalDivision(i, 'superficie');
            superficieCell.textContent = formatearNumero(superficie);
            filaSuperficie.appendChild(superficieCell);
        }
        
        tbody.appendChild(filaSuperficie);
        
        const filaPoblacion = document.createElement('tr');
        const celdaVariablePoblacion = document.createElement('td');
        celdaVariablePoblacion.textContent = 'Población total';
        filaPoblacion.appendChild(celdaVariablePoblacion);
        
        for (let i = 1; i <= currentDivisionCount; i++) {
            const poblacionCell = document.createElement('td');
            const poblacion = calcularTotalDivision(i, 'poblacion_total');
            poblacionCell.textContent = formatearNumero(poblacion);
            filaPoblacion.appendChild(poblacionCell);
        }
        
        tbody.appendChild(filaPoblacion);
        
        const filaDensidad = document.createElement('tr');
        const celdaVariableDensidad = document.createElement('td');
        celdaVariableDensidad.textContent = 'Densidad (hab/km²)';
        filaDensidad.appendChild(celdaVariableDensidad);
        
        for (let i = 1; i <= currentDivisionCount; i++) {
            const densidadCell = document.createElement('td');
            const densidad = calcularDensidadDivision(i);
            densidadCell.textContent = formatearNumero(densidad);
            filaDensidad.appendChild(densidadCell);
        }
        
        tbody.appendChild(filaDensidad);
    } else {
        const filaMensaje = document.createElement('tr');
        const celdaMensaje = document.createElement('td');
        celdaMensaje.colSpan = currentDivisionCount + 1;
        celdaMensaje.textContent = 'Cargando datos de superficie y población...';
        celdaMensaje.style.textAlign = 'center';
        celdaMensaje.style.fontStyle = 'italic';
        celdaMensaje.style.color = '#666';
        filaMensaje.appendChild(celdaMensaje);
        tbody.appendChild(filaMensaje);
    }
}

/*
 * CALCULAR COLOR DE CONTRASTE PARA TEXTO
 */
function getContrastColor(hexColor) {
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/*
 * PROCESAMIENTO DE REDUCCIÓN DE DIVISIONES
 */
function processDivisionReduction(newCount, previousGroups) {
    for (let i = newCount + 1; i <= currentDivisionCount; i++) {
        if (previousGroups[i] && previousGroups[i].departments) {
            previousGroups[i].departments.forEach(deptName => {
                returnDepartmentToMainList(deptName);
            });
        }
    }
}

/*
 * CONFIGURACIÓN DEL SELECTOR DE DIVISIONES
 */
function setupDivisionSelector() {
    const selector = document.getElementById('division-count');
    selector.value = currentDivisionCount;
    
    selector.addEventListener('change', function() {
        const newCount = parseInt(this.value);
        if (newCount !== currentDivisionCount) {
            initializeDivisionBoxes(newCount);
            if (currentRegionType) {
                document.getElementById('existing-regions').value = '';
                currentRegionType = null;
            }
        }
    });
}

/*
 * POBLADO DEL LISTADO DE DEPARTAMENTOS
 */
function populateDepartmentsList(features) {
    const listContainer = document.getElementById('all-departments-list');
    listContainer.innerHTML = '';
    
    features.forEach(feature => {
        const nombre = feature.properties.nam;
        const codigo = feature.properties.cde;
        const isGBA = gbaCodes.includes(codigo);
        
        const item = document.createElement('div');
        item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
        item.textContent = nombre;
        item.setAttribute('data-dept-name', nombre);
        item.setAttribute('data-dept-code', codigo);
        listContainer.appendChild(item);
    });
}

/*
 * INICIALIZACIÓN DEL SISTEMA DRAG & DROP
 */
function initializeDragAndDrop() {
    const allDepartmentsList = document.getElementById('all-departments-list');
    const divisionLists = Array.from({length: currentDivisionCount}, (_, i) => 
        document.getElementById(`division-${i + 1}`)
    );

    // Configurar lista principal
    Sortable.create(allDepartmentsList, {
        group: {
            name: 'departments',
            pull: 'clone',
            put: true
        },
        sort: true,
        animation: 150,
        ghostClass: 'dragging',
        onAdd: function(evt) {
            setTimeout(() => {
                sortMainList();
            }, 100);
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
                    name: 'departamentos',
                    pull: true,
                    put: true
                },
                animation: 150,
                ghostClass: 'dragging',
                onEnd: function(evt) {
                    handleDepartmentMove(evt);
                }
            });
        }
    });
}

/*
 * MANEJO DE MOVIMIENTO DE DEPARTAMENTOS - CORREGIDO
 */
function handleDepartmentMove(evt) {
    const departmentName = evt.item.getAttribute('data-dept-name');
    const toElement = evt.to;
    const fromElement = evt.from;

    // Si el elemento movido está seleccionado, mover todos los seleccionados
    if (evt.item.classList.contains('selected')) {
        const selectedItems = document.querySelectorAll('.department-item.selected');
        const selectedNames = Array.from(selectedItems).map(item => item.getAttribute('data-dept-name'));
        
        selectedNames.forEach(deptName => {
            if (toElement.id === 'all-departments-list') {
                removeDepartmentFromAllDivisions(deptName);
            } else if (fromElement.id === 'all-departments-list') {
                removeDepartmentFromMainList(deptName);
                removeDepartmentFromAllDivisions(deptName, toElement.id);
            } else {
                removeDepartmentFromAllDivisions(deptName, toElement.id);
            }
        });
        
        // Limpiar selección después de mover
        clearSelection();
    } else {
        // Comportamiento normal para elementos no seleccionados
        if (toElement.id === 'all-departments-list') {
            removeDepartmentFromAllDivisions(departmentName);
        } else if (fromElement.id === 'all-departments-list') {
            removeDepartmentFromMainList(departmentName);
            removeDepartmentFromAllDivisions(departmentName, toElement.id);
        } else {
            removeDepartmentFromAllDivisions(departmentName, toElement.id);
        }
    }

    if (currentRegionType) {
        document.getElementById('existing-regions').value = '';
        currentRegionType = null;
    }

    updateDepartmentGroups();
    updateMapColors();
    updateComparisonTable();
    updateRemainingCount();
    
    // Ordenar listado principal si es necesario
    if (toElement.id === 'all-departments-list') {
        sortMainList();
    }
}

/*
 * LIMPIAR SELECCIÓN
 */
function clearSelection() {
    selectedDepartments = [];
    selectedDepartmentsSet.clear();
    
    const selectedItems = document.querySelectorAll('.department-item.selected');
    selectedItems.forEach(item => {
        item.classList.remove('selected');
    });
    
    updateMapColors();
}

/*
 * ELIMINACIÓN DE DEPARTAMENTO DE LISTADO PRINCIPAL
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
 * VERIFICACIÓN SI UN DEPARTAMENTO ESTÁ EN ALGUNA DIVISIÓN
 */
function isDepartmentInDivision(departmentName) {
    for (let groupId in departmentGroups) {
        if (departmentGroups[groupId].departments.includes(departmentName)) {
            return true;
        }
    }
    return false;
}

/*
 * OBTENCIÓN DEL ID DE GRUPO DE UN DEPARTAMENTO
 */
function getDepartmentGroupId(departmentName) {
    for (let groupId in departmentGroups) {
        if (departmentGroups[groupId].departments.includes(departmentName)) {
            return groupId;
        }
    }
    return null;
}

/*
 * ACTUALIZACIÓN DE ESTRUCTURA DE GRUPOS
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
 */
function updateMapColors() {
    if (!geoJsonLayer) return;

    geoJsonLayer.eachLayer(function(layer) {
        const deptName = layer.feature.properties.nam;
        const isGBA = gbaCodes.includes(layer.feature.properties.cde);
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
                weight: 1.5,
                opacity: 1
            });
        } else {
            layer.setStyle({
                fillColor: '#3388ff',
                fillOpacity: 0,
                color: '#2c3e50',
                weight: isGBA ? 1.5 : 0.8,
                opacity: 0.8
            });
        }
    });
}

/*
 * ORDENAMIENTO DEL LISTADO PRINCIPAL
 */
function sortMainList() {
    const listContainer = document.getElementById('all-departments-list');
    const items = Array.from(listContainer.querySelectorAll('.department-item'));
    
    items.sort((a, b) => {
        const nameA = a.getAttribute('data-dept-name').toUpperCase();
        const nameB = b.getAttribute('data-dept-name').toUpperCase();
        return nameA.localeCompare(nameB);
    });
    
    listContainer.innerHTML = '';
    items.forEach(item => {
        listContainer.appendChild(item);
    });
}

/*
 * DEVOLUCIÓN DE DEPARTAMENTO AL LISTADO PRINCIPAL
 */
function returnDepartmentToMainList(departmentName) {
    const listContainer = document.getElementById('all-departments-list');
    
    const dept = allDepartments.find(d => d.properties.nam === departmentName);
    const isGBA = dept && gbaCodes.includes(dept.properties.cde);
    
    const item = document.createElement('div');
    item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
    item.textContent = departmentName;
    item.setAttribute('data-dept-name', departmentName);
    item.setAttribute('data-dept-code', dept ? dept.properties.cde : '');
    
    listContainer.appendChild(item);
    sortMainList();
}

/*
 * CONFIGURACIÓN DEL BOTÓN DE RESET
 */
function setupResetButton() {
    document.getElementById('reset-btn').addEventListener('click', function() {
        resetToInitialState();
    });
}

/*
 * RESTABLECIMIENTO DEL ESTADO INICIAL
 */
function resetToInitialState() {
    if (polygonMode) {
        deactivatePolygonMode();
    }
    
    selectedDepartments = [];
    selectedDepartmentsSet.clear();
    
    const selectedItems = document.querySelectorAll('.department-item.selected');
    selectedItems.forEach(item => {
        item.classList.remove('selected');
    });
    
    for (let i = 1; i <= currentDivisionCount; i++) {
        const divisionList = document.getElementById(`division-${i}`);
        if (divisionList) {
            divisionList.innerHTML = '';
        }
        if (departmentGroups[i]) {
            departmentGroups[i].departments = [];
            departmentGroups[i].name = `División ${i}`;
        }
    }

    populateDepartmentsList(allDepartments);

    geoJsonLayer.eachLayer(function(layer) {
        const isGBA = gbaCodes.includes(layer.feature.properties.cde);
        layer.setStyle({
            fillColor: '#3388ff',
            fillOpacity: 0,
            color: '#2c3e50',
            weight: isGBA ? 1.5 : 0.8,
            opacity: 0.8
        });
    });

    document.getElementById('division-count').value = 3;
    document.getElementById('existing-regions').value = '';
    currentRegionType = null;
    
    initializeDivisionBoxes(3);
    updateRemainingCount();
}

/*
 * RESALTADO DE DEPARTAMENTO
 */
function highlightDepartment(deptName) {
    geoJsonLayer.eachLayer(function(layer) {
        if (layer.feature.properties.nam === deptName) {
            layer.setStyle({
                weight: 2.5,
                color: '#e74c3c',
                fillOpacity: 0.3
            });
            
            setTimeout(() => {
                updateMapColors();
            }, 2000);
        }
    });
}
