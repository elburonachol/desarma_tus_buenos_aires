/*
 * MÓDULO DEL MAPA - map-core.js
 * 
 * Este archivo maneja TODO lo relacionado con el mapa:
 * - Configuración de Leaflet y capas base
 * - Visualización de departamentos GeoJSON
 * - Visualización de comunas de CABA
 * - Herramienta de selección por polígono
 * - Estilos y colores del mapa
 * - Interacciones geográficas
 */

// =============================================
// VARIABLES DEL MÓDULO
// =============================================

// Referencia a la capa que tiene el tooltip actualmente abierto
// Garantiza que nunca haya más de un tooltip visible a la vez
let currentTooltipLayer = null;

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
    
    // Cerrar tooltip activo cuando el cursor sale del área del mapa
    map.on('mouseout', function() {
        if (currentTooltipLayer) {
            currentTooltipLayer.closeTooltip();
            currentTooltipLayer = null;
        }
    });
    
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
 * ESTILO DINÁMICO DE COMUNAS DE CABA
 * Las comunas se tratan con bordes como los departamentos GBA
 * (ya que pertenecen al Gran Buenos Aires)
 */
function getComunaStyle(feature) {
    const comunaName = feature.properties.nam;
    const isSelected = selectedDepartmentsSet.has(comunaName);
    const inDivision = isDepartmentInDivision(comunaName);
    
    // Comuna seleccionada por polígono
    if (isSelected) {
        return {
            fillColor: '#f39c12',
            fillOpacity: 0.7,
            color: '#e67e22',
            weight: 3,
            opacity: 1
        };
    }
    
    // Comuna asignada a una división
    if (inDivision) {
        const groupId = getDepartmentGroupId(comunaName);
        return {
            fillColor: departmentGroups[groupId].color,
            fillOpacity: 0.8,
            color: 'white',
            weight: 2,
            opacity: 1
        };
    }
    
    // Comuna en listado (sin asignar): mismo estilo que GBA (borde más grueso)
    return {
        fillColor: '#3388ff',
        fillOpacity: 0.1,
        color: '#2c3e50',
        weight: 2,     // Mismo peso que GBA (no 1)
        opacity: 0.9
    };
}

/**
 * CONFIGURACIÓN DE INTERACCIONES POR DEPARTAMENTO
 * Define tooltips y comportamientos al hacer hover/click
 */
function setupDepartmentInteractions(feature, layer) {
    const nombre = feature.properties.nam || 'Sin nombre';
    
    // Tooltip con nombre del departamento - controlado manualmente para evitar acumulación
    layer.bindTooltip(`<strong>${nombre}</strong>`, {
        permanent: false,
        direction: 'auto',
        className: 'map-tooltip'
    });
    
    // Click para resaltar temporalmente
    layer.on('click', function() {
        highlightDepartment(nombre);
    });
    
    // Efectos hover: abre tooltip y aplica estilo de resaltado
    layer.on('mouseover', function(e) {
        // Cerrar tooltip de la capa anterior si quedó abierto
        if (currentTooltipLayer && currentTooltipLayer !== layer) {
            currentTooltipLayer.closeTooltip();
        }
        layer.openTooltip(e.latlng);
        currentTooltipLayer = layer;
        
        if (!selectedDepartmentsSet.has(nombre)) {
            layer.setStyle({
                weight: 3,
                color: '#e74c3c',
                fillOpacity: 0.2
            });
        }
    });
    
    // Al salir del departamento: cierra tooltip y restaura estilo original
    layer.on('mouseout', function() {
        layer.closeTooltip();
        currentTooltipLayer = null;
        
        // Vuelve al estilo original según su estado
        const originalStyle = getDepartmentStyle(feature);
        layer.setStyle(originalStyle);
    });
}

/**
 * CONFIGURACIÓN DE INTERACCIONES POR COMUNA
 * Similar a departamentos pero con estilos específicos
 */
function setupComunaInteractions(feature, layer) {
    const nombre = feature.properties.nam || 'Sin nombre';
    
    // Tooltip con nombre de la comuna
    layer.bindTooltip(`<strong>${nombre}</strong>`, {
        permanent: false,
        direction: 'auto',
        className: 'map-tooltip'
    });
    
    // Click para resaltar temporalmente
    layer.on('click', function() {
        highlightDepartment(nombre);
    });
    
    // Efectos hover
    layer.on('mouseover', function(e) {
        if (currentTooltipLayer && currentTooltipLayer !== layer) {
            currentTooltipLayer.closeTooltip();
        }
        layer.openTooltip(e.latlng);
        currentTooltipLayer = layer;
        
        if (!selectedDepartmentsSet.has(nombre)) {
            layer.setStyle({
                weight: 3,
                color: '#e74c3c',
                fillOpacity: 0.2
            });
        }
    });
    
    // Al salir
    layer.on('mouseout', function() {
        layer.closeTooltip();
        currentTooltipLayer = null;
        
        const originalStyle = getComunaStyle(feature);
        layer.setStyle(originalStyle);
    });
}

/**
 * ACTUALIZACIÓN MASIVA DE COLORES DEL MAPA
 * Se ejecuta cuando cambian las asignaciones de departamentos y comunas
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
    
    // Actualizar comunas si están visibles
    if (comunasVisible && comunasLayer) {
        comunasLayer.eachLayer(function(layer) {
            const feature = layer.feature;
            const newStyle = getComunaStyle(feature);
            layer.setStyle(newStyle);
        });
    }
}

/**
 * RESALTADO TEMPORAL DE DEPARTAMENTO O COMUNA
 * Útil para mostrar cuál departamento/comuna se clickeó
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
    
    // Buscar en comunas si están visibles
    if (comunasVisible && comunasLayer) {
        comunasLayer.eachLayer(function(layer) {
            if (layer.feature.properties.nam === deptName) {
                layer.setStyle({
                    weight: 3,
                    color: '#e74c3c',
                    fillOpacity: 0.4
                });
                
                setTimeout(() => {
                    const originalStyle = getComunaStyle(layer.feature);
                    layer.setStyle(originalStyle);
                }, 2000);
            }
        });
    }
}

/**
 * CARGA Y MUESTRA LAS COMUNAS DE CABA EN EL MAPA
 */
function loadComunasLayer() {
    if (!comunasCABA || comunasCABA.length === 0) {
        console.warn('⚠️ No hay datos de comunas cargados');
        return;
    }
    
    if (comunasLayer) {
        map.removeLayer(comunasLayer);
    }
    
    comunasLayer = L.geoJSON(comunasCABA, {
        style: getComunaStyle,
        onEachFeature: setupComunaInteractions
    }).addTo(map);
    
    console.log('✅ Comunas de CABA cargadas en el mapa');
}

/**
 * OCULTA LAS COMUNAS DE CABA DEL MAPA
 */
function removeComunasLayer() {
    if (comunasLayer) {
        map.removeLayer(comunasLayer);
        comunasLayer = null;
    }
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
    
    // Limpiar selección visual previa en la interfaz y el mapa
    document.querySelectorAll('.department-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    updateMapColors(); // Reflejar la deselección en el mapa
    
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
 * Identifica departamentos y comunas cuyo centroide está dentro del polígono y los selecciona
 */
function finalizePolygon() {
    if (polygonPoints.length < 3) {
        alert('Se necesitan al menos 3 puntos para crear un polígono válido');
        return;
    }
    
    console.log(`🔷 Finalizando polígono con ${polygonPoints.length} puntos...`);
    
    // Crear polígono Leaflet para el filtro de bounding box (optimización)
    const leafletPolygon = L.polygon(polygonPoints);
    
    // Identificar departamentos y comunas cuyo centroide está dentro del polígono dibujado
    selectedDepartments = [];
    selectedDepartmentsSet.clear();
    
    geoJsonLayer.eachLayer(function(layer) {
        // Verificación por bounding box primero (filtro rápido)
        if (leafletPolygon.getBounds().intersects(layer.getBounds())) {
            // Verificación precisa: ray casting sobre el centroide del departamento
            const center = layer.getBounds().getCenter();
            if (isPointInPolygon(center, polygonPoints)) {
                const deptName = layer.feature.properties.nam;
                selectedDepartments.push(deptName);
                selectedDepartmentsSet.add(deptName);
            }
        }
    });
    
    // Buscar también en comunas si están visibles
    if (comunasVisible && comunasLayer) {
        comunasLayer.eachLayer(function(layer) {
            if (leafletPolygon.getBounds().intersects(layer.getBounds())) {
                const center = layer.getBounds().getCenter();
                if (isPointInPolygon(center, polygonPoints)) {
                    const comunaName = layer.feature.properties.nam;
                    selectedDepartments.push(comunaName);
                    selectedDepartmentsSet.add(comunaName);
                }
            }
        });
    }
    
    // Mostrar resultados y actualizar interfaz
    if (selectedDepartments.length > 0) {
        console.log(`✅ Seleccionados ${selectedDepartments.length} elementos (departamentos y/o comunas)`);
        
        highlightSelectedDepartments();
        moveSelectedToMainList();
        markSelectedInDivisions();
        
        alert(`Se seleccionaron ${selectedDepartments.length} elementos`);
    } else {
        console.log('⚠️ No se encontraron elementos dentro del polígono');
        alert('No se encontraron elementos dentro del polígono');
    }
    
    // Volver al modo normal
    deactivatePolygonMode();
}

/**
 * VERIFICA SI UN PUNTO ESTÁ DENTRO DE UN POLÍGONO - Algoritmo Ray Casting
 * Lanza un rayo horizontal desde el punto y cuenta las intersecciones
 * con los lados del polígono. Número impar = dentro, par = fuera.
 * @param {L.LatLng} point - Punto a verificar
 * @param {Array<L.LatLng>} polygon - Array de vértices del polígono
 * @returns {boolean} - True si el punto está dentro del polígono
 */
function isPointInPolygon(point, polygon) {
    const x = point.lat;
    const y = point.lng;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lat, yi = polygon[i].lng;
        const xj = polygon[j].lat, yj = polygon[j].lng;
        
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}

/**
 * RESALTADO VISUAL DE DEPARTAMENTOS Y COMUNAS SELECCIONADOS
 * Aplica estilo especial a los elementos dentro del polígono
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
    
    // Resaltar comunas seleccionadas si están visibles
    if (comunasVisible && comunasLayer) {
        comunasLayer.eachLayer(function(layer) {
            const comunaName = layer.feature.properties.nam;
            if (selectedDepartmentsSet.has(comunaName)) {
                layer.setStyle({
                    fillColor: '#f39c12',
                    fillOpacity: 0.7,
                    color: '#e67e22',
                    weight: 3
                });
            }
        });
    }
}

// =============================================
// FUNCIONES AUXILIARES (para otros módulos)
// =============================================

/**
 * Verifica si un departamento o comuna está en alguna división
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
 * Obtiene el ID de grupo de un departamento o comuna
 */
function getDepartmentGroupId(departmentName) {
    for (let groupId in departmentGroups) {
        if (departmentGroups[groupId].departments.includes(departmentName)) {
            return groupId;
        }
    }
    return null;
}
