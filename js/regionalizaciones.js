/*
 * MÓDULO DE REGIONALIZACIONES - regionalizaciones.js
 * 
 * Responsabilidades:
 * - Carga y gestión de capas GeoJSON de regionalizaciones existentes
 * - Visualización de límites con estilos diferenciados
 * - Control de opacidad y superposición de límites
 * - Sistema de leyenda flotante
 * - Control de panel colapsable
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

// =============================================
// PROPUESTA DE ESTILOS MEJORADOS PARA DIFERENCIACIÓN VISUAL
// =============================================

// Basado en las mejores prácticas de visualización de datos:
// 1. Usar combinaciones de colores perceptualmente uniformes
// 2. Variar peso y patrón de línea para máxima diferenciación
// 3. Priorizar contraste contra el fondo del mapa base
// 4. Considerar usuarios con daltonismo (evitar rojo/verde juntos)

const regionalizacionesEstilos = {
    sanitarias: {
        color: '#FF6B6B',      // Rojo coral - bien visible
        weight: 4,             // Aumentado de 3 a 4 para mejor visibilidad
        dashArray: '8, 6',     // Patrón guión-medio
        opacity: 0.9,
        fillOpacity: 0,
        className: 'regionalizacion-layer sanitarias-layer' // Para CSS específico
    },
    electorales: {
        color: '#4ECDC4',      // Turquesa - buen contraste
        weight: 4,             // Aumentado de 2.5 a 4
        dashArray: '12, 8, 2, 8', // Patrón complejo único
        opacity: 0.9,
        fillOpacity: 0,
        className: 'regionalizacion-layer electorales-layer'
    },
    judiciales: {
        color: '#FFD166',      // Amarillo mostaza - muy visible
        weight: 4,             // Aumentado de 3 a 4
        dashArray: '5, 10',    // Guiones largos y espacios
        opacity: 0.9,
        fillOpacity: 0,
        className: 'regionalizacion-layer judiciales-layer'
    },
    educativas: {
        color: '#9B5DE5',      // Púrpura vibrante
        weight: 3,             // Aumentado de 2 a 3
        dashArray: '2, 6',     // Puntos y espacios
        opacity: 0.9,
        fillOpacity: 0,
        className: 'regionalizacion-layer educativas-layer'
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
    
    // Configurar panel colapsable
    setupCollapsiblePanel();
    
    // Configurar controles de checkboxes
    setupRegionalizacionesCheckboxes();
    
    // Configurar slider de opacidad
    setupOpacitySlider();
    
    // Inicializar leyenda flotante
    initializeLegend();
    
    console.log('✅ Sistema de regionalizaciones inicializado');
}

/**
 * CONFIGURA EL PANEL COLAPSABLE DE REGIONALIZACIONES
 */
function setupCollapsiblePanel() {
    const toggleHeader = document.getElementById('regionalizaciones-toggle');
    const content = document.getElementById('regionalizaciones-content');
    const toggleIcon = toggleHeader.querySelector('.toggle-icon');
    
    if (toggleHeader && content) {
        toggleHeader.addEventListener('click', function() {
            const isVisible = content.style.display !== 'none';
            
            if (isVisible) {
                content.style.display = 'none';
                toggleIcon.textContent = '+';
            } else {
                content.style.display = 'block';
                toggleIcon.textContent = '−';
            }
        });
    }
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
 * CONFIGURA LA LEYENDA FLOTANTE
 */
function initializeLegend() {
    const legendHeader = document.querySelector('#regionalizaciones-legend .legend-header');
    const toggleIcon = document.querySelector('#regionalizaciones-legend .toggle-icon');
    
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
    
    // Actualizar leyenda
    updateLegend();
}

/**
 * CARGA UNA CAPA GEOJSON DE REGIONALIZACIÓN
 * @param {string} tipo - Tipo de regionalización
 */
function loadRegionalizacionLayer(tipo) {
    const archivo = getRegionalizacionFileName(tipo);
    
    fetch(`geometrias/${archivo}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar ${archivo}`);
            }
            return response.json();
        })
        .then(data => {
            // Crear capa Leaflet con estilos mejorados
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
                    border-top: ${estilo.weight}px solid ${estilo.color};
                    border-top-style: ${estilo.dashArray.includes('2, 6') ? 'dotted' : 'dashed'};
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
    
    // Colapsar panel si está expandido
    const content = document.getElementById('regionalizaciones-content');
    const toggleIcon = document.querySelector('#regionalizaciones-toggle .toggle-icon');
    if (content && toggleIcon) {
        content.style.display = 'none';
        toggleIcon.textContent = '+';
    }
    
    // Ocultar leyenda
    const legend = document.getElementById('regionalizaciones-legend');
    if (legend) {
        legend.style.display = 'none';
    }
}
