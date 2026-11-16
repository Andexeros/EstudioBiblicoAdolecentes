// Contenido compartido por los tres grupos. Se entrega únicamente mediante
// los endpoints de estudios, con sesión verificada y cuenta aprobada.
const source = 'Clase la unidad(1).pdf';
const passages = [
  ['Hechos 9:26', 'El temor de los discípulos ante la llegada de Saulo'],
  ['Hechos 9:27–28', 'Bernabé se acerca, presenta a Saulo y facilita su integración'],
  ['Juan 17:20–21', 'Jesús pide que quienes creen en Él sean uno'],
  ['Romanos 15:7', 'Recibirnos como Cristo nos recibió, para la gloria de Dios'],
  ['Mateo 18:4', 'La humildad frente a la búsqueda de superioridad'],
  ['Romanos 12:9–10', 'Amor sincero, afecto fraternal y honra mutua'],
  ['1 Corintios 12:12–13', 'Muchos miembros unidos por el Espíritu en un solo cuerpo'],
  ['1 Corintios 12:25–27', 'Cuidarnos, acompañar el sufrimiento y compartir la alegría'],
  ['Efesios 4:1–6', 'Guardar la unidad del Espíritu con humildad, paciencia y amor'],
  ['Gálatas 5:22–23', 'El fruto del Espíritu transforma nuestro carácter y nuestras relaciones'],
  ['Lucas 11:13', 'Pedir al Padre el Espíritu Santo'],
  ['Hechos 2:42, 46–47', 'La comunión de los primeros creyentes en la Palabra, la oración y la mesa'],
  ['1 Pedro 3:8', 'Vivir con un mismo sentir, compasión y amor fraternal'],
  ['Mateo 18:15', 'Hablar personalmente con el hermano para buscar restauración'],
  ['Efesios 2:14', 'Cristo es nuestra paz y derriba la separación'],
];

export const lessonUnidad = {
  id: 'la-unidad',
  name: 'La unidad',
  category: 'Unidad y hermandad',
  headline: ['Derribemos el muro.', 'Acerquémonos en Cristo.'],
  description: 'Prejuicios, orgullo y distancias pueden separarnos. En Cristo aprendemos a recibirnos, cuidarnos y vivir como un solo cuerpo.',
  summary: 'Una hermandad que empieza al acercarnos.',
  storyTitle: 'Saulo y Bernabé: alguien decidió dar el primer paso.',
  story: 'Cuando Saulo llegó a Jerusalén, quiso juntarse con los discípulos, pero ellos le tenían miedo y no creían que fuera un discípulo. Su pasado de persecución hacía comprensible esa reacción. Bernabé se acercó, lo llevó a los apóstoles y contó cómo había conocido al Señor y predicado con valentía. No ignoró lo ocurrido: ayudó a reconocer la transformación de Saulo. Así, quien encontraba distancia pudo estar con ellos. Su ejemplo nos invita a escuchar, conocer y acompañar a las personas antes de encerrarlas en una idea sobre su pasado o su congregación.',
  timeline: [
    {
      title: 'El deseo de pertenecer',
      text: 'Saulo intenta reunirse con los discípulos. Querer acercarse no siempre significa encontrar un lugar de inmediato.',
      ref: 'Hechos 9:26',
    },
    {
      title: 'Una distancia con historia',
      text: 'Los discípulos sienten temor. La unidad requiere escuchar lo que pasó y construir confianza con verdad.',
      ref: 'Hechos 9:26',
    },
    {
      title: 'Bernabé tiende un puente',
      text: 'Se acerca a Saulo, lo presenta y cuenta lo que el Señor hizo en él. Su intervención facilita un encuentro que parecía difícil.',
      ref: 'Hechos 9:27–28',
    },
    {
      title: 'Un hermano encuentra su lugar',
      text: 'Saulo permanece con ellos en Jerusalén. Recibir a alguien también implica integrarlo y acompañarlo después del primer saludo.',
      ref: 'Hechos 9:27–28',
    },
  ],
  points: [
    {
      title: 'La unidad forma parte de lo que Jesús pidió.',
      text: 'Jesús oró por quienes creerían en Él para que fueran uno. Nuestra relación con otros creyentes importa: la hermandad se expresa en la manera en que nos acercamos y nos tratamos.',
      ref: 'Juan 17:20–21',
    },
    {
      title: 'Recibir es más que saludar.',
      text: 'Cristo nos recibió y nos enseña a recibirnos. Si sos anfitrión, acercate a quien quedó solo, presentalo e invitalo a participar. Si sos invitado, animate a conocer a otros, respondé a las invitaciones y permití que se acerquen.',
      ref: 'Romanos 15:7',
    },
    {
      title: 'La humildad abre espacio al otro.',
      text: 'El tamaño, los recursos o el nombre de una congregación no nos hacen superiores. Revisá si una comparación, un comentario o una actitud tuya está levantando una barrera. El amor sincero reconoce y honra al hermano.',
      ref: 'Romanos 12:9–10',
    },
    {
      title: 'Somos diferentes y pertenecemos al mismo cuerpo.',
      text: 'No necesitamos tener los mismos dones, capacidades o funciones para estar unidos. El Espíritu nos une en un solo cuerpo. Nuestras diferencias nos permiten servir y complementarnos en Cristo.',
      ref: '1 Corintios 12:12–13',
    },
    {
      title: 'Lo que le pasa al otro también nos importa.',
      text: 'La hermandad nos lleva a acompañar al que sufre y a alegrarnos con quien recibe honra. Cuando otra congregación crece o un hermano sirve con un don distinto, podemos celebrarlo y buscar su bien.',
      ref: '1 Corintios 12:25–27',
    },
    {
      title: 'Guardemos la unidad del Espíritu.',
      text: 'El Espíritu Santo nos une y nos corresponde cultivar esa unidad en la práctica. Humildad, mansedumbre, paciencia y amor sostienen relaciones reales, incluso cuando convivir exige esfuerzo.',
      ref: 'Efesios 4:1–6',
    },
    {
      title: 'Pidamos al Espíritu que transforme nuestro trato.',
      text: 'El fruto del Espíritu se ve en cómo respondemos: con amor, bondad, paciencia y dominio propio. Busquemos a Dios en oración y dejemos que forme en nosotros un carácter que acerque a las personas.',
      ref: 'Gálatas 5:22–23',
    },
    {
      title: 'Conversemos antes de convertir una molestia en un muro.',
      text: 'Si algo te dolió, distinguí los hechos de lo que supusiste y buscá conversar con amor. Una situación puntual no define a toda una congregación. Escuchar y hablar personalmente ayuda a buscar una solución.',
      ref: 'Mateo 18:15',
    },
    {
      title: 'La hermandad se cultiva al compartir.',
      text: 'Los primeros creyentes perseveraban en la enseñanza, la comunión, la oración y la mesa compartida. Aprovechemos cada encuentro para conocernos y cuidar relaciones que puedan continuar después. Quienes lideramos también enseñamos unidad al escuchar, integrar y actuar frente a la exclusión.',
      ref: 'Hechos 2:42, 46–47',
    },
  ],
  conclusionTitle: 'Cristo es nuestra paz. Demos el primer paso.',
  conclusion: 'En Efesios 2:14, Pablo anuncia que Cristo hizo uno a judíos y gentiles y derribó la separación entre ellos. A la luz de esa paz, revisemos las barreras que levantamos entre hermanos. La hermandad se hace concreta cuando preparamos el corazón, nos acercamos con humildad y cultivamos vínculos sinceros que continúan después de un encuentro.',
  application: 'Identificá una actitud tuya que levante distancia. Esta semana acercate a alguien con quien no solés hablar: escuchalo, invitalo a compartir y buscá un gesto concreto para acompañarlo. Orá por esa relación y pedile al Señor que te ayude a dar el primer paso.',
  anchor: {
    reference: 'Romanos 15:7',
    text: 'Por tanto, recibíos los unos a los otros, como también Cristo nos recibió, para gloria de Dios.',
  },
  extraTitle: 'Del muro al encuentro',
  extra: [
    {
      title: 'Reconocé qué está levantando distancia',
      items: [
        { title: 'Mirá tu propia actitud', text: '¿Qué actitud mía dificulta que otro se acerque? ¿Qué doy por hecho de alguien a quien todavía no conozco? Empezá por lo que podés revisar en vos.' },
        { title: 'Poné en palabras una barrera', text: 'Un prejuicio, la indiferencia, el orgullo o una molestia sin conversar pueden transformarse en un muro. Reconocerlos nos permite buscar una respuesta de amor.' },
      ],
    },
    {
      title: 'Derribá una barrera con una acción',
      items: [
        { title: 'Del prejuicio a conocer a la persona', text: 'Escuchá su historia y hacé una pregunta sincera. No reduzcas a alguien a un comentario, a su pasado o al lugar de donde viene.', ref: 'Hechos 9:27–28' },
        { title: 'Del grupo cerrado a hacer lugar', text: 'Invitá a quien está solo, presentalo y acompañalo para que pueda participar. Si te invitan, respondé con disposición.', ref: 'Romanos 15:7' },
        { title: 'De la superioridad a la humildad', text: 'Valorá lo que Dios hace en otros y reconocé sus dones. No uses las diferencias para poner a una congregación por encima de otra.', ref: 'Mateo 18:4' },
        { title: 'De la suposición a conversar', text: 'Si alguien no te saludó o una actitud te dolió, no des por segura su intención. Buscá aclararlo personalmente con compasión y respeto.', ref: '1 Pedro 3:8' },
      ],
    },
    {
      title: 'Una hermandad que continúa',
      items: [
        { title: 'Prepará el corazón', text: 'Pedile al Padre el Espíritu Santo. Disponete a recibir al otro y a dejarte transformar en tu manera de relacionarte.', ref: 'Lucas 11:13' },
        { title: 'Dá el primer paso', text: 'Elegí un gesto concreto: acercarte, escuchar, invitar o acompañar. No esperes a que toda la iniciativa venga del otro.', ref: 'Romanos 15:7' },
        { title: 'Cuidá el vínculo después', text: 'Volvé a preguntar cómo está, compartí una oración y seguí haciendo lugar. La comunión crece cuando sostenemos el cuidado mutuo.', ref: '1 Corintios 12:25–27' },
      ],
    },
  ],
  color: '#91dcd9',
  art: ['h-v3', 0],
  symbol: 'muro de ladrillos celestes dividido con un camino dorado entre sus partes',
  artWord: 'UNIDAD',
  artCaption: 'Menos barreras. Más encuentro.',
  minutes: 6,
  references: passages.map(([label, topic]) => ({ label, topic, sources: [source] })),
  sourceFiles: [source],
};
