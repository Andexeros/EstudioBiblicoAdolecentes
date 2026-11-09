// Adaptaciones de las presentaciones de noviembre. Solo se entregan mediante
// los endpoints de estudios, con sesión verificada y cuenta aprobada.
const fromPresentation = (source, lesson, passages) => ({
  ...lesson,
  references: passages.map(([label, topic]) => ({ label, topic, sources: [source] })),
  sourceFiles: [source],
});

export const lessonEnvidia = fromPresentation('Clase La Envidia_20261106_212248_0000.pdf', {
  id: 'la-envidia',
  name: 'La envidia',
  category: 'Comparación y contentamiento',
  headline: ['Cuando el bien ajeno', 'me cuesta celebrar.'],
  description: 'Cómo nace la envidia, qué produce en nuestras relaciones y cómo el amor de Cristo transforma nuestra respuesta.',
  summary: 'Aprender a alegrarnos por los demás.',
  storyTitle: 'Saúl y David: cuando el éxito ajeno parece una amenaza.',
  story: 'Después de que David venció a Goliat, el pueblo celebró las victorias de Saúl y de David. Al escuchar que el canto le daba más reconocimiento a David, Saúl se enojó y empezó a mirarlo con desconfianza. Lo que al principio fue una comparación terminó en un intento de herirlo con una lanza. En su reacción también intervinieron el temor y el deseo de conservar su posición.',
  timeline: [
    {
      title: 'Reconocimiento',
      text: 'El pueblo celebra el regreso de los vencedores y reconoce las victorias de David.',
      ref: '1 Samuel 18:6–12',
    },
    {
      title: 'Enojo y comparación',
      text: 'En lugar de compartir la alegría, Saúl se concentra en quién recibió más reconocimiento.',
      ref: '1 Samuel 18:6–12',
    },
    {
      title: 'Desconfianza y resentimiento',
      text: 'A partir de ese día, Saúl mira a David con recelo. Empieza a ver como rival a quien había servido a su pueblo.',
      ref: '1 Samuel 18:6–12',
    },
    {
      title: 'Hostilidad y agresión',
      text: 'Saúl arroja una lanza contra David, que logra esquivarla. La envidia, junto con el temor, daña la relación.',
      ref: '1 Samuel 18:6–12',
    },
  ],
  points: [
    {
      title: 'Reconocé qué te molesta.',
      text: 'La envidia es malestar ante el bien o la ventaja de otra persona. Podés sentir tristeza por algo que todavía no lograste y alegrarte por quien sí lo logró. La diferencia aparece cuando te molesta que esa persona tenga ese bien.',
    },
    {
      title: 'Diferenciá el deseo de la codicia.',
      text: 'Admirar lo bueno de otro o querer alcanzar una meta parecida puede animarte a crecer. Codiciar es desear indebidamente lo ajeno. Revisá lo que ese deseo despierta en vos y cómo tratás al otro.',
      ref: 'Éxodo 20:17',
    },
    {
      title: 'Frená la comparación antes de convertirla en rivalidad.',
      text: 'Compararte puede mostrarte qué valorás. Si alimentás el malestar, puede crecer el resentimiento. Jesús enseña que la envidia sale del corazón; por eso vale la pena reconocerla temprano.',
      ref: 'Marcos 7:21–23',
    },
    {
      title: 'Mirá sus consecuencias.',
      text: 'La envidia puede dejarnos insatisfechos, provocar críticas y conflictos, y hacernos olvidar lo que recibimos de Dios. Santiago relaciona la envidia amarga y la rivalidad con el desorden.',
      ref: 'Santiago 3:14–16',
    },
    {
      title: 'Practicá el contentamiento.',
      text: 'Agradecé lo que ya recibiste. El contentamiento te ayuda a valorar tus propios dones y circunstancias aunque tengas metas que todavía quieras alcanzar.',
      ref: '1 Timoteo 6:6–8',
    },
    {
      title: 'Aprendé a celebrar el bien ajeno.',
      text: 'En el cuerpo de Cristo, la honra de un miembro es motivo de alegría para los demás. Podés empezar por felicitar con sinceridad a alguien que recibió algo bueno.',
      ref: '1 Corintios 12:26',
    },
    {
      title: 'Pedile al Espíritu que transforme tu respuesta.',
      text: 'Dios puede hacer crecer en vos amor, gozo, paz y dominio propio. Reconocé delante de Él lo que te pasa y elegí un gesto concreto de amor hacia la otra persona.',
      ref: 'Gálatas 5:22–23',
    },
  ],
  conclusionTitle: 'El amor se alegra con el otro.',
  conclusion: 'El desafío es aprender a amar sin convertir a las personas en rivales. Como el hermano mayor de la parábola, podemos quedarnos fuera de la fiesta si solo miramos lo que creemos merecer. El Padre nos invita a compartir su alegría.',
  application: 'Pensá en alguien a quien le fue bien esta semana. ¿Te entristeció lo que vos no lograste o te molestó que esa persona lo lograra? Agradecé a Dios por algo que tenés y buscá una forma sincera de celebrar con ella.',
  anchor: {
    reference: '1 Corintios 13:4',
    text: 'El amor es sufrido, es benigno; el amor no tiene envidia…',
  },
  extraTitle: 'Ejemplos y preguntas para conversar',
  extra: [{
    title: 'Un mismo logro, cuatro reacciones',
    items: [
      { title: 'Admiración o aspiración', text: 'Un amigo se compra el celular que vos querías. Podés pensar: «¡Qué bueno! A mí también me gustaría tener uno».' },
      { title: 'Frustración', text: '«Me entristece no poder comprarme uno». Acá el dolor está en lo que todavía no conseguiste.' },
      { title: 'Posible envidia', text: '«Me molesta que él lo tenga y yo no». Preguntate si lo que más te incomoda es el bien que recibió el otro.' },
      { title: 'Envidia hostil', text: '«Ojalá se le rompa». El malestar ya se convirtió en el deseo de que el otro pierda lo que tiene.' },
      { title: 'Una respuesta de amor', text: '¿Cómo sería alegrarte con tu amigo sin esconder lo que te gustaría conseguir? Practicá el consejo de alegrarte con quien se alegra.', ref: 'Romanos 12:15' },
    ],
  }],
  color: '#9bd8ad',
  art: ['g', 0],
  symbol: 'corazón de jade con una veta dorada',
  artWord: 'CONTENTAMIENTO',
  artCaption: 'Un corazón que aprende a alegrarse.',
  minutes: 5,
}, [
  ['Éxodo 20:17', 'La diferencia entre desear y codiciar lo ajeno'],
  ['Marcos 7:21–23', 'La envidia sale del corazón'],
  ['1 Samuel 18:6–12', 'Saúl y David: del reconocimiento a la agresión'],
  ['Proverbios 14:30', 'El efecto de la envidia en la vida interior'],
  ['Santiago 3:14–16', 'El desorden que producen la envidia y la rivalidad'],
  ['Gálatas 5:19–21', 'La envidia entre las obras de la carne'],
  ['1 Corintios 13:4', 'El amor no tiene envidia'],
  ['1 Corintios 12:26', 'Alegrarse cuando otro miembro recibe honra'],
  ['1 Timoteo 6:6–8', 'Piedad y contentamiento'],
  ['Romanos 12:15', 'Alegrarnos con los que se alegran'],
  ['Gálatas 5:22–23', 'El fruto del Espíritu transforma nuestra respuesta'],
  ['Lucas 15:25–32', 'El hermano mayor y la alegría que el padre lo invita a compartir'],
]);

export const lessonEstoicismoEvangelio = fromPresentation('Clase Estoi co-n Cristo_20261109_131627_0000.pdf', {
  id: 'estoicismo-y-evangelio',
  name: 'Estoicismo y Evangelio',
  category: 'Discernimiento y vida cristiana',
  headline: ['¿Qué guía', 'tu manera de vivir?'],
  description: 'Una mirada bíblica a la autoayuda, la ley de atracción y el estoicismo, a la luz del llamado a seguir a Jesús.',
  summary: 'Discernir las ideas que guían nuestra vida.',
  storyTitle: 'Tres propuestas y una pregunta: ¿en quién ponemos nuestra confianza?',
  story: 'La autoayuda propone mejorar mediante recursos propios. La ley de atracción atribuye a los pensamientos y emociones la capacidad de atraer experiencias. El estoicismo invita a vivir con virtud y a distinguir lo que depende de nosotros de lo que no controlamos. La presentación compara estas ideas con el Evangelio y termina con el ejemplo de Juan el Bautista: se alegró al ver que otros se acercaban a Jesús porque su tarea era señalarlo.',
  timeline: [
    {
      title: 'Autoayuda y progreso personal',
      text: 'Propone cultivar hábitos, reconocer fortalezas y debilidades, trabajar hacia metas y ganar autonomía. La clase pregunta qué propósito les damos a esas prácticas.',
      ref: 'Gálatas 6:9',
    },
    {
      title: 'Ley de atracción y manifestación',
      text: 'El estudio ubica esta creencia en el movimiento Nuevo Pensamiento y menciona su difusión por William Walker Atkinson en 1906 y por El secreto, de Rhonda Byrne, en 2006. Visualizar un resultado deseado forma parte de lo que suele llamarse manifestación.',
      ref: null,
    },
    {
      title: 'Estoicismo, razón y virtud',
      text: 'La presentación sitúa sus orígenes en Atenas hacia el año 300 a. C., con Zenón de Citio. Menciona a Séneca, Epicteto y Marco Aurelio. La propuesta distingue nuestras decisiones y juicios de las circunstancias que quedan fuera de nuestro control.',
      ref: null,
    },
    {
      title: 'Juan el Bautista señala a Jesús',
      text: 'Cuando supo que la gente iba a Jesús, Juan reconoció que su gozo estaba en cumplir su misión. «Es necesario que él crezca, pero que yo mengüe».',
      ref: 'Juan 3:26–30',
    },
  ],
  points: [
    {
      title: 'Dale un propósito a tus hábitos.',
      text: 'La disciplina y el autoconocimiento pueden ayudarnos a crecer. La Biblia llama a perseverar en hacer el bien. Podemos cultivar hábitos que nos acerquen a la voluntad de Dios y nos ayuden a servir.',
      ref: 'Gálatas 6:9',
    },
    {
      title: 'Renová tu manera de pensar.',
      text: 'Las ideas que ocupan nuestra mente influyen en nuestras decisiones. La renovación que propone Romanos nos ayuda a discernir la voluntad de Dios y a ponerla en práctica.',
      ref: 'Romanos 12:2',
    },
    {
      title: 'Pedí con confianza en Dios.',
      text: 'La oración expresa confianza en un Dios que escucha. Podemos pedirle lo que necesitamos según su voluntad, sin tratar la fe como una técnica para obtener el resultado que imaginamos.',
      ref: '1 Juan 5:14',
    },
    {
      title: 'Elegí cómo responder.',
      text: 'Examinar lo que pensamos antes de reaccionar puede ayudarnos a ejercer dominio propio. Santiago nos llama a escuchar pronto, hablar con cuidado y dar tiempo antes de enojarnos.',
      ref: 'Santiago 1:19–20',
    },
    {
      title: 'Entregá a Dios lo que no controlás.',
      text: 'Podés tomar una decisión responsable sin controlar lo que otros hagan ni cómo termine una situación. Dios te invita a poner tu ansiedad en Él porque cuida de vos.',
      ref: '1 Pedro 5:7',
    },
    {
      title: 'Dejá que la dificultad forme paciencia.',
      text: 'El estoicismo ve la adversidad como una ocasión para ejercitar la virtud. Santiago presenta la prueba de la fe como una oportunidad para que crezca la paciencia.',
      ref: 'Santiago 1:2–4',
    },
    {
      title: 'Poné a Jesús en el centro.',
      text: 'El discipulado nos llama a negarnos a nosotros mismos, tomar nuestra cruz y seguir a Cristo. Nuestro crecimiento tiene un propósito: parecernos más a Él y hacer la voluntad de Dios.',
      ref: 'Mateo 16:24',
    },
  ],
  conclusionTitle: 'Que Cristo crezca en nuestra vida.',
  conclusion: 'Podemos reconocer el valor de la disciplina, el dominio propio y la gratitud, y examinar el propósito con que los practicamos. El centro del Evangelio es Jesucristo. Nuestra confianza descansa en Dios y el crecimiento se expresa en seguir a Jesús, aun cuando las circunstancias no cambien.',
  application: 'Elegí una situación que hoy no podés controlar. Identificá qué respuesta sí podés tomar, orá entregándole a Dios lo que te preocupa y decidí una acción concreta que refleje el carácter de Jesús.',
  anchor: {
    reference: 'Gálatas 2:20',
    text: 'Con Cristo estoy juntamente crucificado, y ya no vivo yo, mas vive Cristo en mí…',
  },
  extraTitle: 'Claves para discernir las propuestas',
  extra: [
    {
      title: 'Autoayuda: del hábito a la obediencia',
      items: [
        { title: 'Reconocé las herramientas', text: 'Cuatro herramientas para crecer: disciplina para sostener hábitos, autoconocimiento para reconocer límites y fortalezas, superación para trabajar hacia metas y autonomía para resolver problemas.' },
        { title: 'Pasá de escuchar a hacer', text: 'El crecimiento cristiano se vuelve concreto cuando practicamos la Palabra. Pensá qué hábito podría ayudarte a responder a lo que Dios ya te mostró.', ref: 'Santiago 1:22' },
      ],
    },
    {
      title: 'Ley de atracción: pensamiento, gratitud y oración',
      items: [
        { title: 'Pensar en lo bueno', text: 'La manifestación propone concentrarse en un resultado deseado. Filipenses orienta la mente hacia lo verdadero, justo y digno de alabanza.', ref: 'Filipenses 4:8' },
        { title: 'Dar gracias en lo que vivimos', text: 'La gratitud cristiana reconoce el cuidado de Dios en nuestras circunstancias, incluso cuando lo que pedimos todavía no llegó.', ref: '1 Tesalonicenses 5:18' },
        { title: 'Confiar al pedir', text: 'Podemos presentar a Dios nuestros deseos y confiar en que escucha, dejando que su voluntad oriente nuestra oración.', ref: '1 Juan 5:14' },
      ],
    },
  ],
  color: '#edc77c',
  art: ['g', 1],
  symbol: 'Biblia abierta de cristal dorado con una brújula',
  artWord: 'DISCERNIR',
  artCaption: 'Discernir qué guía nuestra vida.',
  minutes: 6,
}, [
  ['Gálatas 6:9', 'Perseverar en hacer el bien'],
  ['Romanos 12:2', 'Renovar la mente y discernir la voluntad de Dios'],
  ['Santiago 1:22', 'Poner en práctica la Palabra'],
  ['Filipenses 4:8', 'Orientar el pensamiento a lo verdadero y bueno'],
  ['1 Tesalonicenses 5:18', 'Dar gracias en toda circunstancia'],
  ['1 Juan 5:14', 'Pedir según la voluntad de Dios'],
  ['Santiago 1:19–20', 'Escuchar antes de hablar y enojarnos'],
  ['1 Pedro 5:7', 'Entregar nuestra ansiedad al Dios que nos cuida'],
  ['Santiago 1:2–4', 'La prueba de la fe produce paciencia'],
  ['Mateo 16:24', 'Negarnos a nosotros mismos y seguir a Cristo'],
  ['Juan 3:26–30', 'La alegría de Juan el Bautista al señalar a Jesús'],
  ['Gálatas 2:20', 'Cristo vive en mí'],
]);
