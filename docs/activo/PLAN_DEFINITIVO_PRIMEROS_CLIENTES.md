# Plan definitivo para conseguir los primeros clientes

Estado: activo desde el 11 de junio de 2026.

Funcion: define el objetivo, alcance y reglas vinculantes hasta cerrar cinco
clientes fundadores. `docs/AHORA.md` decide la fase y las siguientes acciones.
Si una tarea no aparece en uno de esos dos documentos y no resuelve un bloqueo
de venta o entrega, no se hace.

## Objetivo

Antes del 10 de julio de 2026:

- Cerrar cinco clientes de pago.
- Cobrar al menos 2.450 EUR en setup contratado.
- Alcanzar 295 EUR de ingreso mensual recurrente.
- Publicar al menos dos webs de clientes reales.
- Obtener un testimonio y un caso de estudio medible.

Objetivos intermedios:

- Primer deposito cobrado antes del 19 de junio.
- Tres clientes cerrados antes del 30 de junio.
- Cinco clientes cerrados antes del 10 de julio.

## Decisiones cerradas

### Nicho inicial

Solo se prospectan:

- Peluquerias independientes.
- Barberias.
- Centros de estetica no medica.

Zona inicial: **Sevilla capital**. No se amplia a otros municipios hasta completar
los primeros 100 prospectos cualificados y medir respuesta por zona.

Perfil ideal:

- Una ubicacion.
- Entre dos y diez trabajadores.
- Gestiona consultas o citas por telefono, Instagram o WhatsApp.
- Tiene Google Business Profile e Instagram activos.
- No tiene web, su web esta anticuada o reservar resulta dificil.
- El propietario o responsable es accesible.

No se prospectan durante este plan:

- Franquicias o cadenas.
- Clinicas medicas o negocios que traten datos sanitarios.
- Ecommerce.
- Restaurantes.
- Proyectos que exijan app, integraciones a medida o varias sedes.

### Oferta unica

Nombre comercial: **DLS Reservas**.

Promesa:

> En siete dias dejamos tu negocio listo para convertir visitas de Google e Instagram en mensajes y solicitudes de cita.

Incluye:

- Web premium de una pagina, optimizada para movil.
- Servicios, fotos, horarios, ubicacion, resenas y preguntas frecuentes.
- Botones directos a llamada, WhatsApp, mapa y reserva.
- Formulario de contacto y solicitud de cita.
- Chatbot local configurado con la informacion del negocio.
- Configuracion SEO local basica.
- Panel para revisar contactos y solicitudes.
- Medicion de acciones principales y reporte mensual.
- Publicacion, mantenimiento y soporte.
- Una ronda de cambios antes de publicar.

No incluye:

- Chatbot con IA de pago.
- Google OAuth o automatizacion de Business Profile.
- Cobros, tienda online o Stripe.
- App movil.
- Diseno de marca o fotografia profesional.
- Mas de una pagina o una sede.
- Integraciones personalizadas.

### Precio fundador

Valido solo para los primeros cinco clientes:

- Setup: 490 EUR.
- Mantenimiento: 59 EUR al mes.
- Forma de pago: 245 EUR para empezar y 245 EUR antes de publicar.
- El mantenimiento empieza el dia de publicacion.
- Precios antes de impuestos cuando corresponda.
- Dominio pagado por el cliente.

El mantenimiento incluye hosting, monitorizacion, copias, reporte mensual, soporte y hasta 30 minutos de cambios al mes.

Despues del quinto cliente, el precio minimo pasa a 790 EUR de setup y 79 EUR al mes.

### Condiciones de entrega

- Primer borrador movil en 72 horas desde que se reciben textos, fotos y deposito.
- Publicacion en un maximo de siete dias desde que el material esta completo.
- Una ronda de cambios incluida.
- Los retrasos del cliente mueven la fecha de entrega.
- No se empieza trabajo personalizado sin deposito.
- No se hacen pruebas completas gratis. La preventa usa una auditoria y la demo sectorial.

## Reglas hasta cerrar cinco clientes

1. Ventas tiene prioridad diaria sobre desarrollo.
2. No se anade ninguna funcionalidad por intuicion.
3. Solo se desarrolla para resolver un bloqueo repetido por clientes o un riesgo de entrega.
4. Cada cliente recibe la misma oferta y el mismo proceso.
5. Todo cambio fuera de alcance se cotiza aparte o se rechaza.
6. Cada dia laborable termina con el CRM comercial actualizado.
7. Cada propuesta se envia el mismo dia de la reunion.
8. Nunca se promete trafico, posicion SEO o numero de reservas. Se promete una entrega funcional y medible.

## Producto minimo que debe estar listo

No es necesario migrar toda la arquitectura antes de vender. Es obligatorio completar los siguientes puntos antes de publicar el primer cliente:

- Una demo publica impecable para belleza, peluqueria o barberia.
- Backend online con almacenamiento persistente y copias verificadas.
- Token administrativo y CORS de produccion configurados.
- Formulario de lead y reserva con aviso de privacidad, enlace legal y consentimiento.
- Proteccion basica contra spam y abuso en endpoints publicos.
- Prueba completa de lead, reserva, cambio de estado y reporte.
- Procedimiento escrito para recuperar una copia.
- Monitorizacion diaria de `/api/health`.
- Contrato, factura y textos legales revisados para poder cobrar y publicar.

El JSON actual se puede usar para uno o dos pilotos controlados si se revisa y copia a diario. La migracion a una base de datos con concurrencia segura debe completarse antes del cuarto cliente activo.

## Calendario obligatorio

### Fase 0: preparar la venta

Fechas: 11 al 14 de junio.

Resultado obligatorio: el domingo 14 debe existir una URL que pueda mostrarse y una oferta que pueda cobrarse.

Tareas:

- Congelar el alcance definido en este documento.
- Elegir y pulir una unica demo de belleza.
- Publicar demo, backend y portal operativo.
- Completar los bloqueos del producto minimo.
- Crear un documento breve de propuesta y condiciones.
- Preparar medio de cobro y factura.
- Preparar una lista inicial de 100 prospectos.
- Ensayar una demo comercial de diez minutos.

Criterio de salida:

- La demo carga correctamente en movil.
- Un lead y una reserva llegan al panel.
- El reporte registra las acciones.
- Se puede cobrar un deposito ese mismo dia.

### Fase 1: conseguir el primer deposito

Fechas: 15 al 19 de junio.

Resultado obligatorio: al menos un cliente con deposito pagado.

Cuotas acumuladas de la semana:

- 100 contactos nuevos.
- 50 seguimientos.
- Cinco auditorias personalizadas en video o capturas.
- Cinco reuniones realizadas.
- Tres propuestas enviadas.
- Un deposito cobrado.

En cuanto entre el deposito se inicia la entrega sin detener la prospeccion.

### Fase 2: entregar y demostrar

Fechas: 20 al 26 de junio.

Resultado obligatorio: primer cliente publicado o listo para aprobacion y segundo cliente cerrado.

Tareas:

- Entregar el primer borrador en 72 horas.
- Completar la ronda de cambios.
- Publicar y probar el flujo real.
- Pedir testimonio y permiso para usar el caso.
- Mantener las cuotas comerciales diarias.
- Corregir solo bloqueos observados durante la entrega.

### Fase 3: repetir el sistema

Fechas: 27 de junio al 3 de julio.

Resultado obligatorio: tres clientes cerrados y dos entregas publicadas o aprobadas.

Tareas:

- Repetir exactamente el proceso comercial y de entrega.
- Crear el primer caso de estudio.
- Medir tiempo real invertido por cliente.
- Iniciar la migracion de persistencia si ya hay tres clientes activos.
- Eliminar cualquier tarea de entrega que no aporte valor al cliente.

### Fase 4: completar los cinco fundadores

Fechas: 4 al 10 de julio.

Resultado obligatorio: cinco clientes cerrados.

Tareas:

- Usar el caso de estudio para reforzar prospeccion.
- Cerrar los dos clientes restantes.
- Completar la migracion de persistencia antes del cuarto cliente activo.
- Documentar objeciones, tiempos, costes y funcionalidades solicitadas.
- Subir precio para el cliente numero seis.

## Rutina comercial diaria

De lunes a viernes, incluso cuando haya entregas:

### Bloque 1: prospeccion

Duracion: 90 minutos.

- Anadir 20 prospectos cualificados.
- Contactar a los 20 por el canal mas directo disponible.
- Priorizar visita presencial, llamada, Instagram y WhatsApp con permiso.

### Bloque 2: seguimiento

Duracion: 45 minutos.

- Hacer al menos diez seguimientos.
- Responder mensajes pendientes.
- Confirmar reuniones.
- Cerrar cada conversacion con un siguiente paso y fecha.

### Bloque 3: venta o auditoria

Duracion: 60 minutos.

- Realizar reuniones agendadas.
- Si no hay reuniones, crear una auditoria personalizada de dos minutos para el mejor prospecto del dia.
- Enviar propuesta el mismo dia.

### Bloque 4: entrega

Duracion: resto de la jornada.

- Trabajar solo en entregas pagadas o bloqueos del producto minimo.
- Registrar tiempo empleado y decisiones repetibles.

Cuota minima diaria:

- 20 contactos nuevos.
- 10 seguimientos.
- Una reunion o auditoria personalizada.
- Todas las oportunidades actualizadas.

No se termina la jornada sin cumplir la cuota comercial.

## Sistema de prospeccion

### Lista de prospectos

Registrar:

- Negocio.
- Ciudad y direccion.
- Nombre del responsable si se conoce.
- Telefono, Instagram, email y web.
- Problema detectado.
- Canal de contacto.
- Fecha del primer contacto.
- Ultimo seguimiento.
- Siguiente accion.
- Estado.

Estados permitidos:

- Nuevo.
- Contactado.
- Respondio.
- Reunion.
- Propuesta.
- Ganado.
- Perdido.
- Seguimiento futuro.

### Criterio de prioridad

Contactar primero a negocios que cumplan al menos tres condiciones:

- No tienen web.
- La web funciona mal en movil.
- Reservar requiere llamar o buscar informacion.
- Instagram esta activo.
- Tienen buenas resenas en Google.
- Sus servicios son visuales.
- El propietario responde directamente.

### Mensaje inicial

> Hola, soy Luis. He visto vuestro negocio y creo que ahora mismo reservar desde Google o Instagram requiere demasiados pasos. Estoy ayudando a peluquerias y centros de estetica a tener una web movil con WhatsApp, solicitudes de cita y seguimiento, lista en siete dias. He preparado una observacion concreta sobre vuestro caso. Te la puedo enviar?

No enviar enlaces ni propuestas largas en el primer mensaje.

### Seguimiento

Primer seguimiento, dos dias despues:

> Hola, retomo esto porque vi una mejora muy clara para que quien os encuentra desde el movil pueda consultar servicios y pedir cita sin buscar entre varias paginas. Si te encaja, te lo enseño en diez minutos y decides si tiene sentido.

Segundo seguimiento, cinco dias despues:

> Cierro por aqui para no insistir. Esta semana aun tengo una plaza de cliente fundador a 490 EUR de setup. Si mejorar reservas y presencia movil es prioridad, te enseño la propuesta y si no, lo dejamos para mas adelante.

Despues del segundo seguimiento sin respuesta, mover a seguimiento futuro.

## Reunion comercial de quince minutos

1. Preguntar como llegan ahora las consultas y reservas.
2. Preguntar que preguntas repiten mas los clientes.
3. Preguntar que ocurre cuando no pueden responder.
4. Mostrar la demo en movil.
5. Mostrar WhatsApp, reserva, mapa y panel.
6. Explicar entrega en siete dias y mantenimiento.
7. Presentar el precio sin justificarlo en exceso.
8. Pedir el cierre.

Pregunta de cierre:

> Si te entrego la primera version en 72 horas y la dejamos publicada en siete dias, empezamos hoy con el deposito de 245 EUR?

Si no cierra, identificar una unica objecion real y acordar una fecha concreta de respuesta.

## Proceso de entrega de siete dias

### Al cobrar el deposito

En menos de una hora:

- Enviar confirmacion de pago.
- Enviar condiciones y alcance.
- Enviar onboarding.
- Pedir fotos, logo, servicios, horarios, telefono, WhatsApp, enlaces y textos legales.
- Fijar fecha de revision.

### Dia 1

- Crear negocio en DLS.
- Cargar identidad, servicios, horarios y contacto.
- Elegir una direccion visual.
- Configurar CTA principal.

### Dia 2

- Completar contenido, fotos, FAQ, mapa y chatbot.
- Configurar formulario, reserva y tracking.
- Preparar primera version movil.

### Dia 3

- Enviar primera version.
- Realizar reunion de revision de 20 minutos.
- Recoger una unica lista de cambios.

### Dias 4 y 5

- Aplicar cambios.
- Revisar textos, movil, enlaces y conversion.
- Configurar dominio y backend.

### Dia 6

- Ejecutar checklist de aceptacion.
- Solicitar pago final.

### Dia 7

- Publicar.
- Entregar accesos y explicacion breve del panel.
- Programar revision a siete dias.

## Checklist de aceptacion por cliente

- Nombre, telefono, WhatsApp, direccion y horarios correctos.
- Servicios y precios orientativos aprobados.
- Fotos autorizadas por el cliente.
- CTA principal visible en movil.
- Llamada, WhatsApp, mapa y redes funcionan.
- Lead de prueba aparece en el panel.
- Reserva de prueba aparece y puede cambiar de estado.
- Consentimiento y enlaces legales visibles.
- Chatbot responde horario, servicios, ubicacion y reserva.
- Eventos principales aparecen en el reporte.
- Dominio y HTTPS funcionan.
- Copia de datos realizada.
- Cliente sabe revisar contactos y reservas.
- Pago final recibido antes de publicar.

## Metricas semanales

Cada viernes se registran:

- Prospectos nuevos.
- Primeros contactos.
- Respuestas.
- Reuniones.
- Propuestas.
- Depositos.
- Clientes publicados.
- Ingreso cobrado.
- MRR contratado.
- Horas de entrega por cliente.
- Motivos de perdida.

Ratios objetivo:

- Respuesta sobre contactos: 15% o mas.
- Reunion sobre respuestas: 30% o mas.
- Propuesta sobre reuniones: 60% o mas.
- Cierre sobre propuestas: 30% o mas.

Reglas de ajuste:

- Si responde menos del 10%, cambiar mensaje o lista, no el producto.
- Si hay reuniones pero no propuestas, mejorar descubrimiento y demo.
- Si hay propuestas pero no cierres, revisar confianza, alcance o precio.
- Si una entrega supera 20 horas, reducir personalizacion antes de aceptar otro caso similar.

## Desarrollo permitido

### Antes del primer cliente publicado

- Persistencia y despliegue fiables.
- Consentimiento y enlaces legales.
- Proteccion basica contra abuso.
- Pruebas del flujo principal.
- Correcciones de errores que bloqueen demo o entrega.

### Antes del cuarto cliente activo

- Migracion desde JSON a SQLite, Postgres o Supabase.
- Pruebas automatizadas de leads, reservas, autenticacion y reportes.
- Aislamiento y acceso por cliente.
- Backups y restauracion verificados.

### Solo despues del quinto cliente

- Chatbot IA de pago.
- Google OAuth.
- Automatizacion de resenas.
- Ecommerce y Stripe.
- Publicacion automatica.
- Nuevos sectores.
- Nuevos temas visuales.
- Funciones solicitadas por una sola persona.

## Criterios para detener o cambiar el plan

No se cambia el nicho antes de contactar a 200 prospectos cualificados.

No se cambia el precio antes de enviar diez propuestas, salvo que nadie acepte reunion por el precio publicado.

No se construye una funcionalidad nueva hasta que:

- La pidan al menos tres prospectos cualificados; o
- Bloquee una entrega pagada; o
- Reduzca al menos dos horas de trabajo por cliente.

El 10 de julio se realiza una revision completa. Las decisiones posteriores se toman usando ventas, objeciones, tiempos y uso real, no preferencias internas.

## Marcador diario

Completar al final de cada jornada:

```text
Fecha:
Contactos nuevos:
Seguimientos:
Reuniones:
Auditorias:
Propuestas:
Depositos:
Ingreso cobrado:
Entrega realizada:
Bloqueo principal:
Primera tarea de manana:
```

## Donde consultar la prioridad

La cola priorizada y los bloqueos actuales se mantienen exclusivamente en
`docs/AHORA.md`. Este plan define el destino y las reglas; no duplica la lista
diaria de tareas.
