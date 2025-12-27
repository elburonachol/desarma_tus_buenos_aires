/*
 * MÓDULO DEL MAPA - map-core.js
 * 
 * Este archivo maneja TODO lo relacionado con el mapa:
 * - Configuración de Leaflet y capas base
 * - Visualización de departamentos GeoJSON
 * - Herramienta de selección por polígono
 * - Estilos y colores del mapa
 * - Interacciones geográficas
 */

// =============================================
// CONFIGURACIÓN DEL MAPA LEAFLET
// =============================================

/**
 * INICIALIZACIÓN DEL MAPA
 * Configura el mapa Leaflet con la capa base oficial del IGN
 * y establece la vista inicial sobre la Provincia de Buenos Aires
 */
function initializeMap() {
    console.log('🗺️ Inicializando mapa...');
    
    // Crear instancia del mapa centrada en PBA
    map = L.map('map').setView([-36.6769, -59.8499], 7);
    
    // Capa base oficial del IGN - Mapa base en escala de grises
    L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
        attribution: 'Mapa base: <a href="http://www.ign.gob.ar" target="_blank">Instituto Geográfico Nacional</a>',
        minZoom: 3,
        maxZoom: 18,
        crossOrigin: true // Importante para evitar problemas CORS
    }).addTo(map);
    
    console.log('✅ Mapa inicializado correctamente');
}

// =============================================
// GESTIÓN DE LA CAPA GEOJSON
// =============================================

/**
 * ESTILO DINÁMICO DE DEPARTAMENTOS
 * Define cómo se ven los departamentos según su estado:
 * - En listado: transparentes con borde
 * - En división: coloreados según su grupo
 * - Seleccionados: resaltados en naranja
 */
function getDepartmentStyle(feature) {
    const deptName = feature.properties.nam;
    const isGBA = gbaCodes.includes(feature.properties.cde);
    const isSelected = selectedDepartmentsSet.has(deptName);
    const inDivision = isDepartmentInDivision(deptName);
    
    // Departamento seleccionado por polígono
    if (isSelected) {
        return {
            fillColor: '#f39c12',
            fillOpacity: 0.7,
            color: '#e67e22',
            weight: 3,
            opacity: 1
        };
    }
    
    // Departamento asignado a una división
    if (inDivision) {
        const groupId = getDepartmentGroupId(deptName);
        return {
            fillColor: departmentGroups[groupId].color,
            fillOpacity: 0.8,
            color: 'white',  // Borde blanco para que se destaque sobre las regionalizaciones
            weight: 2,       // Borde más grueso para departamentos asignados
            opacity: 1
        };
    }
    
    // Departamento en listado (sin asignar)
    // Estilo para departamentos no asignados: más tenue
    if (isGBA) {
        // Departamento del GBA sin asignar: borde más grueso y color azul
        return {
            fillColor: '#3388ff',
            fillOpacity: 0.1,  // Muy transparente
            color: '#2c3e50',  // Color oscuro para el borde
            weight: 2,         // Borde más grueso para GBA
            opacity: 0.9
        };
    } else {
        // Departamento no GBA sin asignar: borde más delgado
        return {
            fillColor: '#3388ff',
            fillOpacity: 0.05, // Casi transparente
            color: '#2c3e50',
            weight: 1,         // Borde delgado
            opacity: 0.7
        };
    }
}

/**
 * CONFIGURACIÓN DE INTERACCIONES POR DEPARTAMENTO
 * Define tooltips y comportamientos al hacer hover/click
 */
function setupDepartmentInteractions(feature, layer) {
    const nombre = feature.properties.nam || 'Sin nombre';
    
    // Tooltip con nombre del departamento
    layer.bindTooltip(`<strong>${nombre}</strong>`, {
        permanent: false,
        direction: 'auto',
        className: 'map-tooltip'
    });
    
    // Click para resaltar temporalmente
    layer.on('click', function() {
        highlightDepartment(nombre);
    });
    
    // Efectos hover - resaltado temporal
    layer.on('mouseover', function() {
        if (!selectedDepartmentsSet.has(nombre)) {
            layer.setStyle({
                weight: 3,
                color: '#e74c3c',
                fillOpacity: 0.2
            });
        }
    });
    
    layer.on('mouseout', function() {
        // Vuelve al estilo original según su estado
        const originalStyle = getDepartmentStyle(feature);
        layer.setStyle(originalStyle);
    });
}

/**
 * ACTUALIZACIÓN MASIVA DE COLORES DEL MAPA
 * Se ejecuta cuando cambian las asignaciones de departamentos
 * para reflejar los cambios visualmente
 */
function updateMapColors() {
    if (!geoJsonLayer) {
        console.warn('⚠️ No hay capa GeoJSON para actualizar');
        return;
    }
    
    geoJsonLayer.eachLayer(function(layer) {
        const feature = layer.feature;
        const newStyle = getDepartmentStyle(feature);
        layer.setStyle(newStyle);
    });
}

/**
 * RESALTADO TEMPORAL DE DEPARTAMENTO
 * Útil para mostrar cuál departamento se clickeó
 */
function highlightDepartment(deptName) {
    geoJsonLayer.eachLayer(function(layer) {
        if (layer.feature.properties.nam === deptName) {
            // Resaltado temporal
            layer.setStyle({
                weight: 3,
                color: '#e74c3c',
                fillOpacity: 0.4
            });
            
            // Vuelve al estilo original después de 2 segundos
            setTimeout(() => {
                const originalStyle = getDepartmentStyle(layer.feature);
                layer.setStyle(originalStyle);
            }, 2000);
        }
    });
}

// =============================================
// HERRAMIENTA DE SELECCIÓN POR POLÍGONO
// =============================================

/**
 * ACTIVACIÓN DEL MODO POLÍGONO
 * Prepara el mapa para dibujar polígonos de selección
 */
function activatePolygonMode() {
    console.log('🔷 Activando modo polígono...');
    
    polygonMode = true;
    polygonPoints = [];
    selectedDepartments = [];
    selectedDepartmentsSet.clear();
    
    // Feedback visual en la interfaz
    document.getElementById('polygon-btn').classList.add('active');
    document.getElementById('polygon-info').style.display = 'block';
    
    // Cambiar cursor del mapa
    map.getContainer().style.cursor = 'crosshair';
    
    // Configurar eventos del mapa para modo polígono
    map.on('click', handleMapClick);
    map.on('contextmenu', handleMapRightClick);
    
    console.log('✅ Modo polígono activado - Clic izquierdo: agregar puntos | Clic derecho: finalizar');
}

/**
 * DESACTIVACIÓN DEL MODO POLÍGONO  
 * Limpia todo y vuelve al modo normal
 */
function deactivatePolygonMode() {
    console.log('🔷 Desactivando modo polígono...');
    
    polygonMode = false;
    
    // Restaurar interfaz
    document.getElementById('polygon-btn').classList.remove('active');
    document.getElementById('polygon-info').style.display = 'none';
    map.getContainer().style.cursor = '';
    
    // Limpiar elementos visuales del polígono
    if (polygonLayer) {
        map.removeLayer(polygonLayer);
        polygonLayer = null;
    }
    if (polylineLayer) {
        map.removeLayer(polylineLayer);
        polylineLayer = null;
    }
    
    // Limpiar marcadores de puntos
    pointMarkers.forEach(marker => map.removeLayer(marker));
    pointMarkers = [];
    
    // Remover eventos específicos del modo polígono
    map.off('click', handleMapClick);
    map.off('contextmenu', handleMapRightClick);
    
    console.log('✅ Modo polígono desactivado');
}

/**
 * MANEJO DE CLICK IZQUIERDO - Agregar punto al polígono
 */
function handleMapClick(e) {
    if (!polygonMode) return;
    
    // Agregar punto a la lista
    polygonPoints.push(e.latlng);
    
    // Marcador visual del punto
    const marker = L.circleMarker(e.latlng, {
        radius: 6,
        fillColor: '#e74c3c',
        color: '#c0392b',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map);
    pointMarkers.push(marker);
    
    // Actualizar visualización del polígono
    drawPolygon();
    if (polygonPoints.length >= 2) {
        drawPolyline();
    }
    
    // Límite de puntos por seguridad
    if (polygonPoints.length >= 100) {
        finalizePolygon();
    }
}

/**
 * MANEJO DE CLICK DERECHO - Finalizar polígono
 */
function handleMapRightClick(e) {
    if (!polygonMode || polygonPoints.length < 3) return;
    
    e.originalEvent.preventDefault(); // Evitar menú contextual
    finalizePolygon();
}

/**
 * DIBUJAR POLÍGONO RELLENO
 * Crea la forma cerrada del polígono
 */
function drawPolygon() {
    // Limpiar polígono anterior
    if (polygonLayer) {
        map.removeLayer(polygonLayer);
    }
    
    // Crear nuevo polígono si hay suficientes puntos
    if (polygonPoints.length >= 3) {
        polygonLayer = L.polygon(polygonPoints, {
            color: '#3498db',
            weight: 2,
            fillColor: '#3498db',
            fillOpacity: 0.2
        }).addTo(map);
    }
}

/**
 * DIBUJAR LÍNEA DE POLÍGONO
 * Muestra la línea que conecta los puntos
 */
function drawPolyline() {
    // Limpiar línea anterior
    if (polylineLayer) {
        map.removeLayer(polylineLayer);
    }
    
    // Crear nueva línea
    polylineLayer = L.polyline(polygonPoints, {
        color: '#e74c3c',
        weight: 2,
        opacity: 0.8,
        dashArray: '5, 10' // Línea punteada
    }).addTo(map);
}

/**
 * FINALIZACIÓN DEL POLÍGONO
 * Identifica departamentos dentro del polígono y los selecciona
 */
function finalizePolygon() {
    if (polygonPoints.length < 3) {
        alert('Se necesitan al menos 3 puntos para crear un polígono válido');
        return;
    }
    
    console.log(`🔷 Finalizando polígono con ${polygonPoints.length} puntos...`);
    
    // Crear polígono Leaflet para cálculos espaciales
    const polygon = L.polygon(polygonPoints);
    
    // Identificar departamentos que intersectan con el polígono
    selectedDepartments = [];
    selectedDepartmentsSet.clear();
    
    geoJsonLayer.eachLayer(function(layer) {
        // Verificación por bounding box primero (más rápida)
        if (polygon.getBounds().intersects(layer.getBounds())) {
            // Verificación más precisa usando el centroide
            const center = layer.getBounds().getCenter();
            if (polygon.getBounds().contains(center)) {
                const deptName = layer.feature.properties.nam;
                selectedDepartments.push(deptName);
                selectedDepartmentsSet.add(deptName);
            }
        }
    });
    
    // Mostrar resultados y actualizar interfaz
    if (selectedDepartments.length > 0) {
        console.log(`✅ Seleccionados ${selectedDepartments.length} departamentos`);
        
        highlightSelectedDepartments();
        moveSelectedToMainList();
        markSelectedInDivisions();
        
        alert(`Se seleccionaron ${selectedDepartments.length} departamentos`);
    } else {
        console.log('⚠️ No se encontraron departamentos dentro del polígono');
        alert('No se encontraron departamentos dentro del polígono');
    }
    
    // Volver al modo normal
    deactivatePolygonMode();
}

/**
 * RESALTADO VISUAL DE DEPARTAMENTOS SELECCIONADOS
 * Aplica estilo especial a los departamentos dentro del polígono
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

// =============================================
// FUNCIONES AUXILIARES (para otros módulos)
// =============================================

/**
 * Verifica si un departamento está en alguna división
 */
function isDepartmentInDivision(departmentName) {
    for (let groupId in departmentGroups) {
        if (departmentGroups[groupId].departments.includes(departmentName)) {
            return true;
        }
    }
    return false;
}

/**
 * Obtiene el ID de grupo de un departamento
 */
function getDepartmentGroupId(departmentName) {
    for (let groupId in departmentGroups) {
        if (departmentGroups[groupId].departments.includes(departmentName)) {
            return groupId;
        }
    }
    return null;
}

// =============================================
// FUNCIONES PENDIENTES (implementadas en otros módulos)
// =============================================

// Estas funciones se llaman desde este módulo pero se implementan en otros

function moveSelectedToMainList() {
    // Implementado en ui-controls-core.js
}

function markSelectedInDivisions() {
    // Implementado en ui-controls-core.js  
}
