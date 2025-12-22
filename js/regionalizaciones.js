/*
 * MÓDULO DE REGIONALIZACIONES - regionalizaciones.js
 * 
 * Responsabilidades:
 * - Carga y gestión de capas GeoJSON de regionalizaciones existentes
 * - Visualización de límites con estilos diferenciados
 * - Control de opacidad y superposición de límites
 * - Sistema de leyenda flotante
 * - Modo "sólo límites coincidentes"
 */

// =============================================
// VARIABLES GLOBALES DEL MÓDULO
// =============================================

let regionalizacionesLayers = {
    sanitarias: null,
    electorales: null,
    judiciales: null,
    educativas: null
};

let regionalizacionesActivas = {
    sanitarias: false,
    electorales: false,
    judiciales: false,
    educativas: false
};

let regionalizacionesOpacity = 0.7;
let soloCoincidentesMode = false;

// Estilos para cada tipo de regionalización
const regionalizacionesEstilos = {
    sanitarias: {
        color: '#e74c3c',
        weight: 2.5,
        dashArray: '5, 5',
        opacity: 0.7,
        fillOpacity: 0
    },
    electorales: {
        color: '#3498db',
        weight: 2,
        dashArray: '10, 5',
        opacity: 0.7,
        fillOpacity: 0
    },
    judiciales: {
        color: '#2ecc71',
        weight: 2.5,
        dashArray: '15, 5, 5, 5',
        opacity: 0.7,
        fillOpacity: 0
    },
    educativas: {
        color: '#9b59b6',
        weight: 2,
        dashArray: '8, 8',
        opacity: 0.7,
        fillOpacity: 0
    }
};

// Nombres para mostrar en la leyenda
const regionalizacionesNombres = {
    sanitarias: 'Regiones Sanitarias',
    electorales: 'Secciones Electorales',
    judiciales: 'Departamentos Judiciales',
    educativas: 'Regiones Educativas'
};

// =============================================
// INICIALIZACIÓN DEL MÓDULO
// =============================================

/**
 * INICIALIZA EL SISTEMA DE REGIONALIZACIONES
 * Configura controles, event listeners y leyenda
 */
function initializeRegionalizaciones() {
    console.log('🗺️ Inicializando sistema de regionalizaciones...');
    
    // Configurar controles de checkboxes
    setupRegionalizacionesCheckboxes();
    
    // Configurar slider de opacidad
    setupOpacitySlider();
    
    // Configurar modo "sólo coincidentes"
    setupSoloCoincidentes();
    
    // Inicializar leyenda flotante
    initializeLegend();
    
    console.log('✅ Sistema de regionalizaciones inicializado');
}

/**
 * CONFIGURA LOS CHECKBOXES DE REGIONALIZACIONES
 */
function setupRegionalizacionesCheckboxes() {
    const tipos = ['sanitarias', 'electorales', 'judiciales', 'educativas'];
    
    tipos.forEach(tipo => {
        const checkbox = document.getElementById(`toggle-${tipo}`);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                toggleRegionalizacion(tipo, this.checked);
            });
        }
    });
}

/**
 * CONFIGURA EL SLIDER DE OPACIDAD
 */
function setupOpacitySlider() {
    const slider = document.getElementById('regionalizaciones-opacity');
    const valueDisplay = document.getElementById('opacity-value');
    
    if (slider && valueDisplay) {
        // Inicializar con valor por defecto
        valueDisplay.textContent = Math.round(regionalizacionesOpacity * 100);
        slider.value = regionalizacionesOpacity * 100;
        
        slider.addEventListener('input', function() {
            regionalizacionesOpacity = this.value / 100;
            valueDisplay.textContent = this.value;
            updateRegionalizacionesOpacity();
        });
    }
}

/**
 * CONFIGURA EL MODO "SÓLO LÍMITES COINCIDENTES"
 */
function setupSoloCoincidentes() {
    const checkbox = document.getElementById('solo-coincidentes');
    if (checkbox) {
        checkbox.addEventListener('change', function() {
            soloCoincidentesMode = this.checked;
            updateRegionalizacionesStyles();
        });
    }
}

/**
 * CONFIGURA LA LEYENDA FLOTANTE
 */
function initializeLegend() {
    const legendHeader = document.querySelector('.legend-header');
    const toggleIcon = document.querySelector('.toggle-icon');
    
    if (legendHeader && toggleIcon) {
        legendHeader.addEventListener('click', function() {
            const legend = document.getElementById('regionalizaciones-legend');
            legend.classList.toggle('minimized');
            
            // Cambiar ícono
            toggleIcon.textContent = legend.classList.contains('minimized') ? '+' : '−';
        });
    }
    
    // Actualizar leyenda inicialmente
    updateLegend();
}

// =============================================
// GESTIÓN DE CAPAS DE REGIONALIZACIONES
// =============================================

/**
 * ACTIVA/DESACTIVA UNA REGIONALIZACIÓN
 * @param {string} tipo - Tipo de regionalización
 * @param {boolean} activar - True para activar, false para desactivar
 */
function toggleRegionalizacion(tipo, activar) {
    regionalizacionesActivas[tipo] = activar;
    
    if (activar) {
        // Si la capa no está cargada, cargarla
        if (!regionalizacionesLayers[tipo]) {
            loadRegionalizacionLayer(tipo);
        } else {
            // Si ya está cargada, mostrarla
            map.addLayer(regionalizacionesLayers[tipo]);
        }
    } else {
        // Ocultar la capa si está cargada
        if (regionalizacionesLayers[tipo]) {
            map.removeLayer(regionalizacionesLayers[tipo]);
        }
    }
    
    // Actualizar leyenda y estilos
    updateLegend();
    if (soloCoincidentesMode) {
        updateRegionalizacionesStyles();
    }
}

/**
 * CARGA UNA CAPA GEOJSON DE REGIONALIZACIÓN
 * @param {string} tipo - Tipo de regionalización
 */
function loadRegionalizacionLayer(tipo) {
    const archivo = getRegionalizacionFileName(tipo);
    
    fetch(`regiones/${archivo}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar ${archivo}`);
            }
            return response.json();
        })
        .then(data => {
            // Crear capa Leaflet
            const layer = L.geoJSON(data, {
                style: regionalizacionesEstilos[tipo],
                interactive: false // Sin tooltips ni interacciones
            });
            
            // Aplicar opacidad actual
            layer.setStyle({ opacity: regionalizacionesOpacity });
            
            // Guardar referencia y añadir al mapa
            regionalizacionesLayers[tipo] = layer;
            map.addLayer(layer);
            
            console.log(`✅ Cargada capa de ${regionalizacionesNombres[tipo]}`);
        })
        .catch(error => {
            console.error(`❌ Error cargando ${tipo}:`, error);
            regionalizacionesActivas[tipo] = false;
            
            // Desmarcar checkbox en caso de error
            const checkbox = document.getElementById(`toggle-${tipo}`);
            if (checkbox) {
                checkbox.checked = false;
            }
            
            alert(`Error al cargar ${regionalizacionesNombres[tipo]}. Verifica la consola para más detalles.`);
        });
}

/**
 * OBTIENE EL NOMBRE DEL ARCHIVO GEOJSON SEGÚN EL TIPO
 * @param {string} tipo - Tipo de regionalización
 * @returns {string} - Nombre del archivo
 */
function getRegionalizacionFileName(tipo) {
    const archivos = {
        sanitarias: 'region_sanitaria.geojson',
        electorales: 'seccion_electoral.geojson',
        judiciales: 'depto_judicial.geojson',
        educativas: 'region_educativa.geojson'
    };
    return archivos[tipo];
}

/**
 * ACTUALIZA LA OPACIDAD DE TODAS LAS REGIONALIZACIONES ACTIVAS
 */
function updateRegionalizacionesOpacity() {
    Object.keys(regionalizacionesLayers).forEach(tipo => {
        const layer = regionalizacionesLayers[tipo];
        if (layer && regionalizacionesActivas[tipo]) {
            layer.setStyle({ opacity: regionalizacionesOpacity });
        }
    });
}

/**
 * ACTUALIZA LOS ESTILOS PARA EL MODO "SÓLO COINCIDENTES"
 * (Implementación básica - puede mejorarse para coincidencias exactas)
 */
function updateRegionalizacionesStyles() {
    if (soloCoincidentesMode) {
        // Contar cuántas regionalizaciones están activas
        const activas = Object.values(regionalizacionesActivas).filter(v => v).length;
        
        if (activas >= 2) {
            // En modo coincidentes, mostrar todas las activas
            Object.keys(regionalizacionesLayers).forEach(tipo => {
                const layer = regionalizacionesLayers[tipo];
                if (layer) {
                    if (regionalizacionesActivas[tipo]) {
                        map.addLayer(layer);
                        layer.setStyle({ opacity: regionalizacionesOpacity });
                    } else {
                        map.removeLayer(layer);
                    }
                }
            });
        } else {
            // Si hay menos de 2 activas, desactivar el modo
            const checkbox = document.getElementById('solo-coincidentes');
            if (checkbox) {
                checkbox.checked = false;
                soloCoincidentesMode = false;
                alert('El modo "Sólo límites coincidentes" requiere al menos 2 regionalizaciones activas.');
            }
        }
    } else {
        // Modo normal: mostrar/ocultar según checkboxes
        Object.keys(regionalizacionesLayers).forEach(tipo => {
            const layer = regionalizacionesLayers[tipo];
            if (layer) {
                if (regionalizacionesActivas[tipo]) {
                    map.addLayer(layer);
                } else {
                    map.removeLayer(layer);
                }
            }
        });
    }
    
    updateLegend();
}

// =============================================
// LEYENDA FLOTANTE
// =============================================

/**
 * ACTUALIZA LA LEYENDA FLOTANTE
 */
function updateLegend() {
    const legendContent = document.querySelector('.legend-content');
    if (!legendContent) return;
    
    // Limpiar contenido actual
    legendContent.innerHTML = '';
    
    // Agregar elementos para cada regionalización activa
    Object.keys(regionalizacionesActivas).forEach(tipo => {
        if (regionalizacionesActivas[tipo]) {
            const estilo = regionalizacionesEstilos[tipo];
            const nombre = regionalizacionesNombres[tipo];
            
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `
                <span class="legend-line" style="
                    border-top: ${estilo.weight}px dashed ${estilo.color};
                    border-top-style: ${estilo.dashArray === '5, 5' ? 'dashed' : 
                                      estilo.dashArray === '10, 5' ? 'dotted' :
                                      estilo.dashArray === '15, 5, 5, 5' ? 'double' : 'dashed'};
                    opacity: ${estilo.opacity};
                "></span>
                <span class="legend-label">${nombre}</span>
            `;
            
            legendContent.appendChild(legendItem);
        }
    });
    
    // Mostrar u ocultar leyenda según si hay elementos
    const legend = document.getElementById('regionalizaciones-legend');
    const hasActiveLayers = Object.values(regionalizacionesActivas).some(v => v);
    
    if (hasActiveLayers) {
        legend.style.display = 'block';
    } else {
        legend.style.display = 'none';
    }
}

// =============================================
// FUNCIONES PÚBLICAS PARA OTROS MÓDULOS
// =============================================

/**
 * LIMPIA TODAS LAS REGIONALIZACIONES (para reset)
 */
function clearRegionalizaciones() {
    Object.keys(regionalizacionesLayers).forEach(tipo => {
        const layer = regionalizacionesLayers[tipo];
        if (layer) {
            map.removeLayer(layer);
        }
        regionalizacionesActivas[tipo] = false;
    });
    
    // Desmarcar checkboxes
    const tipos = ['sanitarias', 'electorales', 'judiciales', 'educativas'];
    tipos.forEach(tipo => {
        const checkbox = document.getElementById(`toggle-${tipo}`);
        if (checkbox) {
            checkbox.checked = false;
        }
    });
    
    // Desactivar modo coincidentes
    const coincidentesCheckbox = document.getElementById('solo-coincidentes');
    if (coincidentesCheckbox) {
        coincidentesCheckbox.checked = false;
        soloCoincidentesMode = false;
    }
    
    // Ocultar leyenda
    const legend = document.getElementById('regionalizaciones-legend');
    if (legend) {
        legend.style.display = 'none';
    }
}
