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
 * 16. Selección por polígono de múltiples departamentos con arrastre grupal
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
let selectedDepartments = []; // Departamentos seleccionados por el polígono (persistentes hasta que se deseleccionen)

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
 * Se ejecuta cuando el DOM está completamente cargado
 * Ahora carga tanto el GeoJSON, datos de partidos y regiones existentes
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    
    // Cargar tanto el GeoJSON, datos de partidos y regiones existentes de manera concurrente
    Promise.all([
        loadGeoJSON(),
        loadPartidosData(),
        loadRegionesExistentes()
    ]).then(() => {
        initializeDivisionBoxes(currentDivisionCount);
        setupResetButton();
        setupDivisionSelector();
        setupRegionSelector(); // Configurar el selector de regiones existentes
        setupPolygonButton();  // Configurar el botón de polígono
        setupMapClickDeselect(); // Configurar el clic en el mapa para deseleccionar
        initializeComparisonTable();
        updateRemainingCount();
    }).catch(error => {
        console.error('Error en la inicialización:', error);
    });
});

/*
 * CONFIGURACIÓN DEL BOTÓN DE POLÍGONO
 * Maneja la activación/desactivación del modo de dibujo de polígono
 */
function setupPolygonButton() {
    const polygonBtn = document.getElementById('polygon-btn');
    
    polygonBtn.addEventListener('click', function() {
        if (polygonMode) {
            // Si ya está activo, desactivar
            deactivatePolygonMode();
        } else {
            // Activar modo polígono
            activatePolygonMode();
        }
    });
}

/*
 * CONFIGURACIÓN DEL CLIC EN EL MAPA PARA DESELECCIONAR
 * Agrega un event listener al mapa para deseleccionar departamentos cuando se haga clic en un área sin departamento
 */
function setupMapClickDeselect() {
    map.on('click', function(e) {
        // Verificar si el clic fue en un departamento (usando un timeout para permitir que el evento del departamento se procese primero)
        setTimeout(() => {
            // Si no hay ningún departamento seleccionado por polígono, no hacemos nada
            if (selectedDepartments.length === 0) return;
            
            // Deseleccionar todos los departamentos
            clearSelection();
        }, 10);
    });
}

/*
 * LIMPIAR SELECCIÓN
 * Quita el resaltado de los departamentos seleccionados y limpia la variable
 */
function clearSelection() {
    // Quitar el resaltado de los departamentos seleccionados
    geoJsonLayer.eachLayer(function(layer) {
        const deptName = layer.feature.properties.nam;
        if (selectedDepartments.includes(deptName)) {
            // Restaurar el estilo normal
            updateDepartmentStyle(layer);
        }
    });
    
    // Limpiar la lista de departamentos seleccionados
    selectedDepartments = [];
}

/*
 * ACTUALIZAR ESTILO DE DEPARTAMENTO
 * Aplica el estilo correspondiente a un departamento según su estado actual
 */
function updateDepartmentStyle(layer) {
    const deptName = layer.feature.properties.nam;
    const isGBA = gbaCodes.includes(layer.feature.properties.cde);
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
            color: 'white',
            weight: 1.5, // Borde reducido
            opacity: 1
        });
    } else {
        // Si no está en división: transparente (solo borde)
        layer.setStyle({
            fillColor: '#3388ff',
            fillOpacity: 0,  // Transparente
            color: '#2c3e50', // Mismo color para todos
            weight: isGBA ? 2 : 1, // Borde más grueso para GBA (reducido)
            opacity: 0.8
        });
    }
}

/*
 * ACTIVACIÓN DEL MODO POLÍGONO
 * Prepara el mapa y la interfaz para el dibujo de polígonos
 */
function activatePolygonMode() {
    polygonMode = true;
    polygonPoints = [];
    selectedDepartments = [];
    
    // Actualizar interfaz
    document.getElementById('polygon-btn').classList.add('active');
    document.getElementById('polygon-info').style.display = 'block';
    updatePointCounter();
    
    // Cambiar cursor del mapa
    map.getContainer().style.cursor = 'crosshair';
    
    // Configurar eventos del mapa para modo polígono
    map.on('click', handleMapClick);
    map.on('contextmenu', handleMapRightClick);
    
    console.log('Modo polígono activado');
}

/*
 * DESACTIVACIÓN DEL MODO POLÍGONO
 * Restaura el estado normal del mapa y la interfaz
 */
function deactivatePolygonMode() {
    polygonMode = false;
    
    // Actualizar interfaz
    document.getElementById('polygon-btn').classList.remove('active');
    document.getElementById('polygon-info').style.display = 'none';
    
    // Restaurar cursor del mapa
    map.getContainer().style.cursor = '';
    
    // Limpiar capas de polígono
    if (polygonLayer) {
        map.removeLayer(polygonLayer);
        polygonLayer = null;
    }
    if (polylineLayer) {
        map.removeLayer(polylineLayer);
        polylineLayer = null;
    }
    
    // Remover eventos del mapa
    map.off('click', handleMapClick);
    map.off('contextmenu', handleMapRightClick);
    
    console.log('Modo polígono desactivado');
}

/*
 * MANEJO DE CLICK IZQUIERDO EN EL MAPA (MODO POLÍGONO)
 * Agrega un punto al polígono en construcción
 */
function handleMapClick(e) {
    if (!polygonMode) return;
    
    // Agregar punto a la lista
    polygonPoints.push(e.latlng);
    updatePointCounter();
    
    // Dibujar/actualizar el polígono
    drawPolygon();
    
    // Si tenemos al menos 2 puntos, dibujar la línea
    if (polygonPoints.length >= 2) {
        drawPolyline();
    }
    
    // Si alcanzamos 100 puntos, finalizar automáticamente
    if (polygonPoints.length >= 100) {
        finalizePolygon();
    }
}

/*
 * MANEJO DE CLICK DERECHO EN EL MAPA (MODO POLÍGONO)
 * Finaliza el polígono y selecciona los departamentos
 */
function handleMapRightClick(e) {
    if (!polygonMode || polygonPoints.length < 3) return;
    
    e.originalEvent.preventDefault(); // Prevenir menú contextual
    finalizePolygon();
}

/*
 * ACTUALIZACIÓN DEL CONTADOR DE PUNTOS
 * Muestra cuántos puntos se han agregado al polígono
 */
function updatePointCounter() {
    document.getElementById('point-counter').textContent = polygonPoints.length;
}

/*
 * DIBUJO DEL POLÍGONO
 * Crea o actualiza la capa del polígono en el mapa
 */
function drawPolygon() {
    // Remover polígono anterior si existe
    if (polygonLayer) {
        map.removeLayer(polygonLayer);
    }
    
    // Crear nuevo polígono si hay al menos 3 puntos
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
 * Crea o actualiza la capa de línea que conecta los puntos
 */
function drawPolyline() {
    // Remover línea anterior si existe
    if (polylineLayer) {
        map.removeLayer(polylineLayer);
    }
    
    // Crear nueva línea
    polylineLayer = L.polyline(polygonPoints, {
        color: '#e74c3c',
        weight: 2,
        opacity: 0.8,
        dashArray: '5, 10'
    }).addTo(map);
}

/*
 * FINALIZACIÓN DEL POLÍGONO
 * Identifica los departamentos dentro del polígono y los selecciona
 */
function finalizePolygon() {
    if (polygonPoints.length < 3) {
        alert('Se necesitan al menos 3 puntos para crear un polígono válido');
        return;
    }
    
    // Crear polígono Leaflet
    const polygon = L.polygon(polygonPoints);
    
    // Identificar departamentos que intersectan con el polígono
    selectedDepartments = [];
    
    geoJsonLayer.eachLayer(function(layer) {
        if (polygon.getBounds().intersects(layer.getBounds())) {
            // Verificar intersección más precisa usando el centroide
            const center = layer.getBounds().getCenter();
            if (polygon.getBounds().contains(center)) {
                const deptName = layer.feature.properties.nam;
                selectedDepartments.push(deptName);
            }
        }
    });
    
    // Mostrar resultados
    if (selectedDepartments.length > 0) {
        // Resaltar departamentos seleccionados (persistentemente)
        highlightSelectedDepartments();
        
        // Mover departamentos seleccionados al listado principal si no están ya
        moveSelectedToMainList();
        
        alert(`Se seleccionaron ${selectedDepartments.length} departamentos. Ahora puede arrastrar cualquiera de ellos para mover todo el grupo.`);
    } else {
        alert('No se encontraron departamentos dentro del polígono');
    }
    
    // Desactivar modo polígono
    deactivatePolygonMode();
}

/*
 * RESALTADO DE DEPARTAMENTOS SELECCIONADOS
 * Aplica un estilo especial a los departamentos seleccionados por el polígono (persistente)
 */
function highlightSelectedDepartments() {
    geoJsonLayer.eachLayer(function(layer) {
        const deptName = layer.feature.properties.nam;
        if (selectedDepartments.includes(deptName)) {
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
 * Asegura que los departamentos seleccionados estén disponibles en el listado
 */
function moveSelectedToMainList() {
    const listContainer = document.getElementById('all-departments-list');
    
    selectedDepartments.forEach(deptName => {
        // Verificar si el departamento ya está en el listado
        const existingItems = listContainer.querySelectorAll('.department-item');
        let alreadyInList = false;
        
        existingItems.forEach(item => {
            if (item.getAttribute('data-dept-name') === deptName) {
                alreadyInList = true;
            }
        });
        
        // Si no está en el listado, agregarlo
        if (!alreadyInList) {
            // Recuperar el departamento de allDepartments para obtener su código
            const dept = allDepartments.find(d => d.properties.nam === deptName);
            const isGBA = dept && gbaCodes.includes(dept.properties.cde);
            
            const item = document.createElement('div');
            item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
            item.textContent = deptName;
            item.setAttribute('data-dept-name', deptName);
            item.setAttribute('data-dept-code', dept ? dept.properties.cde : '');
            
            listContainer.appendChild(item);
        }
    });
    
    // Ordenar el listado
    sortMainList();
    
    // Actualizar contador
    updateRemainingCount();
}

/*
 * CARGA DE DATOS DE REGIONES EXISTENTES DESDE ARCHIVO JSON
 * Carga los datos de secciones electorales y regiones sanitarias
 * desde regiones/regiones_existentes.json
 */
async function loadRegionesExistentes() {
    try {
        const response = await fetch('regiones/regiones_existentes.json');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        regionesExistentes = await response.json();
        console.log('Datos de regiones existentes cargados:', regionesExistentes);
        return true;
    } catch (error) {
        console.error('Error cargando datos de regiones existentes:', error);
        // No bloqueamos la aplicación si falla la carga de datos
        return true;
    }
}

/*
 * CONFIGURACIÓN DEL SELECTOR DE REGIONES EXISTENTES
 * Maneja los cambios en el menú desplegable de regiones existentes
 */
function setupRegionSelector() {
    const selector = document.getElementById('existing-regions');
    
    selector.addEventListener('change', function() {
        const selectedOption = this.value;
        if (selectedOption) {
            loadExistingRegions(selectedOption);
        } else {
            // Si se selecciona la opción por defecto (vacía), restablecer
            currentRegionType = null;
        }
    });
}

/*
 * CARGA DE REGIONES EXISTENTES EN LAS DIVISIONES
 * Carga las regiones existentes (secciones electorales o regiones sanitarias) en las divisiones
 */
function loadExistingRegions(tipoRegion) {
    if (!regionesExistentes) {
        console.error('No se cargaron los datos de regiones existentes');
        return;
    }

    // Obtener las regiones según el tipo seleccionado
    const regiones = regionesExistentes[tipoRegion];
    if (!regiones) {
        console.error(`Tipo de región no válido: ${tipoRegion}`);
        return;
    }

    // Guardar el tipo de región actual
    currentRegionType = tipoRegion;

    // Obtener los nombres de las regiones y ordenarlos
    const nombresRegiones = Object.keys(regiones).sort();
    const numeroRegiones = nombresRegiones.length;

    // Actualizar el número de divisiones al número de regiones
    document.getElementById('division-count').value = numeroRegiones;
    initializeDivisionBoxes(numeroRegiones);

    // Limpiar el listado principal primero
    const listContainer = document.getElementById('all-departments-list');
    listContainer.innerHTML = '';

    // Para cada región, asignar los departamentos correspondientes
    nombresRegiones.forEach((nombreRegion, index) => {
        const groupId = index + 1;
        const departamentosRegion = regiones[nombreRegion];

        // Actualizar el nombre de la división
        departmentGroups[groupId].name = nombreRegion;
        const editableName = document.querySelector(`[data-group-id="${groupId}"] .editable-division-name`);
        if (editableName) {
            editableName.textContent = nombreRegion;
        }

        // Obtener el contenedor de la división
        const divisionList = document.getElementById(`division-${groupId}`);
        if (divisionList) {
            // Limpiar la división
            divisionList.innerHTML = '';

            // Agregar cada departamento de la región
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

    // Actualizar estado y mapa
    updateDepartmentGroups();
    updateMapColors();
    
    // Actualizar tabla comparativa y contador
    updateComparisonTable();
    updateRemainingCount();
}

/*
 * CARGA DE DATOS DE PARTIDOS DESDE ARCHIVO JSON
 * Carga los datos de superficie, población y otras variables
 * desde datos/datos_partidos.json
 */
async function loadPartidosData() {
    try {
        const response = await fetch('datos/datos_partidos.json');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        partidosData = await response.json();
        console.log('Datos de partidos cargados:', partidosData);
        console.log(`Variables disponibles: ${Object.keys(partidosData.variables)}`);
        return true;
    } catch (error) {
        console.error('Error cargando datos de partidos:', error);
        // No bloqueamos la aplicación si falla la carga de datos
        return true;
    }
}

/*
 * INICIALIZACIÓN DEL MAPA LEAFLET
 * Configura el mapa con capa base oficial del IGN en escala de grises
 * Utiliza la URL correcta del servicio TMS del IGN según su documentación oficial
 * Garantiza la representación correcta de la soberanía argentina en Malvinas
 */
function initializeMap() {
    // Crear mapa centrado en la Provincia de Buenos Aires
    map = L.map('map').setView([-36.6769, -59.8499], 7);

    // Capa base oficial del IGN - Mapa base gris (según documentación oficial)
    L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
        attribution: '<a href="http://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | <a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">Instituto Geográfico Nacional</a>',
        minZoom: 3,
        maxZoom: 18
    }).addTo(map);
}

/*
 * CARGA DEL ARCHIVO GEOJSON PBA.geojson
 * Carga todos los departamentos sin filtrar, usando campos "cde" y "nam"
 * Los ordena alfabéticamente por el campo "nam"
 * Identifica y marca los departamentos del Gran Buenos Aires con texto en negrita
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
            // No filtramos - cargamos todos los features
            const allFeatures = data.features;

            console.log(`Departamentos cargados: ${allFeatures.length}`);

            // Ordenar alfabéticamente por el campo "nam"
            allFeatures.sort((a, b) => {
                const nameA = (a.properties.nam || '').toUpperCase();
                const nameB = (b.properties.nam || '').toUpperCase();
                return nameA.localeCompare(nameB);
            });

            // Guardar referencia a todos los departamentos (para reset)
            allDepartments = allFeatures;

            // Crear capa GeoJSON en el mapa
            geoJsonLayer = L.geoJSON(allFeatures, {
                // Leaflet maneja automáticamente la reproyección de EPSG:4326 a EPSG:3857
                style: function(feature) {
                    // Verificar si es un departamento del GBA
                    const isGBA = gbaCodes.includes(feature.properties.cde);
                    
                    // Estilo por defecto: transparente (sin relleno) con borde visible
                    // GBA tiene bordes más gruesos pero mismo color que los demás
                    // Cambio: bordes menos gruesos (reducido de 1.5/2.5 a 1/2)
                    return {
                        fillColor: '#3388ff',
                        fillOpacity: 0,  // Transparente - sin relleno
                        color: '#2c3e50', // Mismo color para todos los bordes
                        weight: isGBA ? 2 : 1, // Borde más grueso para GBA (reducido)
                        opacity: 0.8
                    };
                },
                onEachFeature: function(feature, layer) {
                    // Tooltip con el nombre del departamento y código
                    const nombre = feature.properties.nam || 'Sin nombre';
                    const codigo = feature.properties.cde || 'N/A';
                    const isGBA = gbaCodes.includes(codigo);
                    
                    layer.bindTooltip(`<strong>${nombre}</strong><br>Código: ${codigo}`, {
                        permanent: false,
                        direction: 'auto'
                    });
                    
                    // Click para resaltar individualmente y deseleccionar grupo si es necesario
                    layer.on('click', function(e) {
                        // Si hay departamentos seleccionados por polígono, deseleccionarlos al hacer clic en un departamento no seleccionado
                        if (selectedDepartments.length > 0 && !selectedDepartments.includes(nombre)) {
                            clearSelection();
                        }
                        highlightDepartment(nombre);
                    });

                    // Efectos hover para mejor UX
                    layer.on('mouseover', function() {
                        layer.setStyle({
                            weight: 2,
                            color: '#e74c3c',
                            fillOpacity: 0.1
                        });
                    });

                    layer.on('mouseout', function() {
                        // Volver al estilo original según si está en división o no
                        const deptName = feature.properties.nam;
                        const isGBA = gbaCodes.includes(feature.properties.cde);
                        const inDivision = isDepartmentInDivision(deptName);
                        
                        if (inDivision) {
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
                                weight: isGBA ? 2 : 1, // Borde más grueso para GBA (reducido)
                                opacity: 0.8
                            });
                        }
                    });
                }
            }).addTo(map);

            // Ajustar vista del mapa para mostrar todos los departamentos
            setTimeout(() => {
                map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });
            }, 100);
            
            // Poblar el listado de departamentos
            populateDepartmentsList(allFeatures);
            
            // Actualizar contadores
            document.getElementById('dept-count').textContent = allFeatures.length;
        })
        .catch(error => {
            console.error('Error cargando el GeoJSON:', error);
            alert('Error al cargar el archivo GeoJSON. Verifica la consola para más detalles.');
        });
}

/*
 * ACTUALIZACIÓN DEL CONTADOR DE DEPARTAMENTOS RESTANTES
 * Calcula y muestra cuántos departamentos quedan en el listado principal
 */
function updateRemainingCount() {
    const listContainer = document.getElementById('all-departments-list');
    const remainingCount = listContainer.querySelectorAll('.department-item').length;
    document.getElementById('dept-remaining-count').textContent = remainingCount;
}

/*
 * INICIALIZACIÓN DE CAJAS DE DIVISIÓN
 * Crea dinámicamente las cajas de división según el número especificado
 * Maneja inteligentemente la reducción de divisiones preservando las superiores
 * Ahora con nombres editables
 */
function initializeDivisionBoxes(newCount) {
    const container = document.getElementById('division-boxes-container');
    
    // Guardar el estado actual de las divisiones antes del cambio
    const previousGroups = JSON.parse(JSON.stringify(departmentGroups));
    
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
        
        // Configurar evento para nombres editables
        const editableName = groupBox.querySelector('.editable-division-name');
        editableName.addEventListener('blur', function() {
            departmentGroups[i].name = this.textContent;
            updateComparisonTable();
            // Si estamos en modo región existente, deseleccionar
            if (currentRegionType) {
                document.getElementById('existing-regions').value = '';
                currentRegionType = null;
            }
        });
        
        // Permitir Enter para guardar el nombre
        editableName.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.blur();
            }
        });
        
        // Si existía esta división antes, restaurar sus departamentos
        if (previousGroups[i] && previousGroups[i].departments) {
            const divisionList = document.getElementById(`division-${i}`);
            previousGroups[i].departments.forEach(deptName => {
                // Recuperar el departamento de allDepartments para obtener su código
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

    // Reinicializar sistema de drag & drop
    initializeDragAndDrop();
    
    // Actualizar estado y colores del mapa
    updateDepartmentGroups();
    updateMapColors();
    
    // Actualizar tabla comparativa y contador
    updateComparisonTable();
    updateRemainingCount();
}

/*
 * INICIALIZACIÓN DE LA TABLA COMPARATIVA
 * Configura la estructura inicial de la tabla
 */
function initializeComparisonTable() {
    updateComparisonTable();
}

/*
 * OBTENER CÓDIGO CDE POR NOMBRE DE DEPARTAMENTO
 * Función auxiliar para encontrar el código CDE dado un nombre de departamento
 */
function obtenerCodigoCdePorNombre(nombreDepartamento) {
    const departamento = allDepartments.find(dept => dept.properties.nam === nombreDepartamento);
    return departamento ? departamento.properties.cde : null;
}

/*
 * CALCULAR TOTAL DE UNA VARIABLE PARA UNA DIVISIÓN
 * Suma los valores de una variable específica para todos los departamentos en una división
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
    
    // Si no hay datos para ningún partido, retornar 0
    return partidosConDatos > 0 ? total : 0;
}

/*
 * CALCULAR DENSIDAD POBLACIONAL PARA UNA DIVISIÓN
 * Calcula la densidad (población/superficie) para una división
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
 * Convierte un número a string con separadores de miles para mejor legibilidad
 */
function formatearNumero(numero) {
    if (numero === 0 || numero === '0') return '0';
    if (!numero) return '-';
    
    return numero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/*
 * ACTUALIZACIÓN DE LA TABLA COMPARATIVA
 * Genera y actualiza la tabla con las estadísticas de las divisiones
 * Ahora incluye superficie, población y densidad
 * Usa los nombres editables de las divisiones
 */
function updateComparisonTable() {
    const table = document.getElementById('comparison-table');
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');
    
    // Limpiar tabla existente
    thead.innerHTML = '<th>Variable</th>';
    tbody.innerHTML = '';
    
    // Crear encabezados de columnas (divisiones) con nombres editables
    for (let i = 1; i <= currentDivisionCount; i++) {
        const th = document.createElement('th');
        th.textContent = departmentGroups[i] ? departmentGroups[i].name : `División ${i}`;
        th.style.backgroundColor = departmentGroups[i] ? departmentGroups[i].color : '#f8f9fa';
        th.style.color = getContrastColor(departmentGroups[i] ? departmentGroups[i].color : '#f8f9fa');
        thead.appendChild(th);
    }
    
    // Crear fila de "Cantidad de partidos"
    const filaCantidad = document.createElement('tr');
    const celdaVariableCantidad = document.createElement('td');
    celdaVariableCantidad.textContent = 'Cantidad de partidos';
    filaCantidad.appendChild(celdaVariableCantidad);
    
    // Calcular y agregar cantidad de partidos por división
    for (let i = 1; i <= currentDivisionCount; i++) {
        const countCell = document.createElement('td');
        const count = departmentGroups[i] ? departmentGroups[i].departments.length : 0;
        countCell.textContent = count;
        filaCantidad.appendChild(countCell);
    }
    
    tbody.appendChild(filaCantidad);
    
    // Solo agregar las filas de datos si tenemos los datos cargados
    if (partidosData && partidosData.datos) {
        // Crear fila de "Superficie total (km²)"
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
        
        // Crear fila de "Población total"
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
        
        // Crear fila de "Densidad (hab/km²)"
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
        // Mostrar mensaje si no hay datos disponibles
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
 * Determina si usar texto blanco o negro según el color de fondo
 */
function getContrastColor(hexColor) {
    // Convertir hex a RGB
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    
    // Calcular luminosidad
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Retornar negro para fondos claros, blanco para fondos oscuros
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/*
 * PROCESAMIENTO DE REDUCCIÓN DE DIVISIONES
 * Maneja la lógica cuando se reducen el número de divisiones
 * Elimina solo las divisiones inferiores y preserva las superiores
 */
function processDivisionReduction(newCount, previousGroups) {
    // Para cada división que será eliminada (las de más abajo, números más altos)
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
    // Aumentar a 12 divisiones
    selector.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        if (i === 3) option.selected = true;
        selector.appendChild(option);
    }
    selector.value = currentDivisionCount;
    
    selector.addEventListener('change', function() {
        const newCount = parseInt(this.value);
        if (newCount !== currentDivisionCount) {
            initializeDivisionBoxes(newCount);
            // Si estamos en modo región existente, deseleccionar
            if (currentRegionType) {
                document.getElementById('existing-regions').value = '';
                currentRegionType = null;
            }
        }
    });
}

/*
 * POBLADO DEL LISTADO DE DEPARTAMENTOS
 * Llena la lista principal con todos los departamentos ordenados
 * Aplica texto en negrita a los departamentos del Gran Buenos Aires (sin franja roja)
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
        ghostClass: 'dragging',
        onAdd: function(evt) {
            // Ordenar automáticamente cuando se agrega un elemento
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
 * MANEJO DE MOVIMIENTO DE DEPARTAMENTOS
 * Procesa los eventos de drag & drop entre listas
 * Si el departamento arrastrado está seleccionado, mueve todos los seleccionados
 */
function handleDepartmentMove(evt) {
    const departmentName = evt.item.getAttribute('data-dept-name');
    const toElement = evt.to;
    const fromElement = evt.from;

    // Determinar si estamos moviendo un departamento seleccionado
    const movingSelected = selectedDepartments.length > 0 && selectedDepartments.includes(departmentName);

    // Si estamos moviendo un departamento seleccionado, mover todos los seleccionados
    if (movingSelected) {
        moveSelectedDepartments(toElement.id);
    } else {
        // Comportamiento normal para un solo departamento
        handleSingleDepartmentMove(departmentName, toElement, fromElement);
    }

    // Si estamos en modo región existente, deseleccionar
    if (currentRegionType) {
        document.getElementById('existing-regions').value = '';
        currentRegionType = null;
    }

    // Actualizar estado y mapa
    updateDepartmentGroups();
    updateMapColors();
    
    // Actualizar tabla comparativa y contador
    updateComparisonTable();
    updateRemainingCount();
}

/*
 * MANEJO DE MOVIMIENTO DE UN SOLO DEPARTAMENTO
 * Procesa el movimiento de un departamento individual
 */
function handleSingleDepartmentMove(departmentName, toElement, fromElement) {
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
}

/*
 * MOVIMIENTO DE DEPARTAMENTOS SELECCIONADOS
 * Mueve todos los departamentos seleccionados a la división de destino
 */
function moveSelectedDepartments(toDivisionId) {
    // Obtener el ID de la división de destino
    const divisionId = toDivisionId.replace('division-', '');
    
    // Para cada departamento seleccionado
    selectedDepartments.forEach(deptName => {
        // Remover de donde esté (listado o divisiones)
        removeDepartmentFromMainList(deptName);
        removeDepartmentFromAllDivisions(deptName, toDivisionId);
        
        // Agregar a la división de destino
        const divisionList = document.getElementById(toDivisionId);
        if (divisionList) {
            // Verificar si el departamento ya está en la división de destino
            const existingItems = divisionList.querySelectorAll('.department-item');
            let alreadyInDivision = false;
            
            existingItems.forEach(item => {
                if (item.getAttribute('data-dept-name') === deptName) {
                    alreadyInDivision = true;
                }
            });
            
            // Si no está, agregarlo
            if (!alreadyInDivision) {
                const dept = allDepartments.find(d => d.properties.nam === deptName);
                const isGBA = dept && gbaCodes.includes(dept.properties.cde);
                
                const item = document.createElement('div');
                item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
                item.textContent = deptName;
                item.setAttribute('data-dept-name', deptName);
                item.setAttribute('data-dept-code', dept ? dept.properties.cde : '');
                
                divisionList.appendChild(item);
            }
        }
    });
    
    // Limpiar la selección después de mover
    clearSelection();
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
 * VERIFICACIÓN SI UN DEPARTAMENTO ESTÁ EN ALGUNA DIVISIÓN
 * Función auxiliar para determinar el estado de color en el mapa
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
 * Función auxiliar para encontrar en qué división está un departamento
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
 * Departamentos en listado: transparentes | Departamentos en divisiones: coloreados
 */
function updateMapColors() {
    if (!geoJsonLayer) return;

    geoJsonLayer.eachLayer(function(layer) {
        updateDepartmentStyle(layer);
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
    
    // Recuperar el departamento de allDepartments para obtener su código
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
    // Desactivar modo polígono si está activo
    if (polygonMode) {
        deactivatePolygonMode();
    }
    
    // Limpiar selección
    clearSelection();
    
    // Limpiar todas las divisiones
    for (let i = 1; i <= currentDivisionCount; i++) {
        const divisionList = document.getElementById(`division-${i}`);
        if (divisionList) {
            divisionList.innerHTML = '';
        }
        if (departmentGroups[i]) {
            departmentGroups[i].departments = [];
            departmentGroups[i].name = `División ${i}`; // Restaurar nombre por defecto
        }
    }

    // Restaurar listado completo
    populateDepartmentsList(allDepartments);

    // Restablecer estilo del mapa (transparente)
    geoJsonLayer.eachLayer(function(layer) {
        const isGBA = gbaCodes.includes(layer.feature.properties.cde);
        layer.setStyle({
            fillColor: '#3388ff',
            fillOpacity: 0,
            color: '#2c3e50',
            weight: isGBA ? 2 : 1, // Borde más grueso para GBA (reducido)
            opacity: 0.8
        });
    });

    // Restablecer selectores
    document.getElementById('division-count').value = 3;
    document.getElementById('existing-regions').value = '';
    currentRegionType = null;
    
    initializeDivisionBoxes(3);
    
    // Actualizar contador de departamentos restantes
    updateRemainingCount();
}

/*
 * RESALTADO DE DEPARTAMENTO
 * Función auxiliar para resaltar un departamento temporalmente
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
                updateDepartmentStyle(layer);
            }, 2000);
        }
    });
}
[file content end]
