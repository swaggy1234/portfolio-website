/**
 * SITE CONTENT & PROJECT DATA
 * Edit all text, links, and project details here.
 */

export const siteConfig = {
  name: 'Sraghvi Anchaliya',
  monogram: 'SA',
  email: 'sraghvia@gmail.com',
  introDuration: 1800, // milliseconds — change intro timing

  heroStatement: [
    "I'M A CREATIVE TECHNOLOGIST",
    'WORKING AT THE INTERSECTION OF',
    'DATA, DESIGN & HUMAN EXPERIENCE',
  ],

  social: {
    github: 'https://github.com/swaggy1234',
    linkedin: 'https://www.linkedin.com/in/sraghvi-anchaliya-13527a173/',
    email: 'mailto:sraghvia@gmail.com',
  },

  /**
   * Scroll-scrubbed lotus GIF (bottom-left sticker).
   * Uses opening frames only (bud → bloom), not the close-back half.
   */
  scrollFlowerVideo: {
    framesDir: '/videos/flower-frames',
    /** Frames 0–23 = open; later frames close again — omit those */
    frameCount: 24,
    lineThreshold: 225,
    lineColor: '#3d0f24',
    lineThickness: 3,
    /** Full page scroll = full bloom; higher ease = slower mid-page opening */
    scrollSpan: 1,
    scrollEase: 1.5,
  },
};

export const projects = [
  {
    id: 1,
    title: 'VisProm Interactive Wine Data Visualization',
    category: 'Data Visualization',
    year: '2026',
    tag: 'Research',
    image: '/images/visprom-cover.png',
    imageFit: 'contain',
    link: '/visprom/index.html',
    github: 'https://github.com/swaggy1234/visprom',
    popup: 'visprom',
    popupUrl: '/visprom/index.html',
    popupTitle: '@ VISPROM ONLINE :)',
  },
  {
    id: 2,
    title: 'Robotics Demonstration Retrieval',
    category: 'AI / Data Systems',
    year: '2025',
    tag: 'Research',
    image:
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&q=80&auto=format&fit=crop',
    link: '#',
    github: 'https://github.com/swaggy1234/ds4300-Final',
    popup: 'pdf',
    popupAsset: 'roboticsPresentationPdf',
    popupTitle: 'Robotics Demonstration Retrieval',
  },
  {
    id: 3,
    title: 'Stock Market Simulator',
    category: 'Data / Interactive Systems',
    year: '2025',
    tag: 'Project',
    image:
      'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80&auto=format&fit=crop',
    link: '/demos/stock-market.html',
    github: 'https://github.com/swaggy1234/stock-market-simulator',
    popup: 'demo',
    popupUrl: '/demos/stock-market.html',
    popupTitle: 'Stock Market Simulator',
  },
  {
    id: 4,
    title: 'Heart Disease Predictor',
    category: 'Machine Learning',
    year: '2024',
    tag: 'Project',
    image:
      'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=1200&q=80&auto=format&fit=crop',
    link: '/demos/heart-disease.html',
    github:
      'https://github.com/swaggy1234/Heart-Health-through-Machine-Learning-Predictive-Modeling-for-heart-Disease-Detection',
    popup: 'demo',
    popupUrl: '/demos/heart-disease.html',
    popupTitle: 'Heart Disease Predictor',
  },
  {
    id: 5,
    title: 'NBA Player Performance',
    category: 'Sports Analytics',
    year: '2024',
    tag: 'Project',
    image:
      'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&q=80&auto=format&fit=crop',
    link: '/demos/nba-predictor.html',
    github: 'https://github.com/swaggy1234/Exploring_NBA_Player_Performance',
    popup: 'demo',
    popupUrl: '/demos/nba-predictor.html',
    popupTitle: 'NBA Player Performance Explorer',
  },
];

export const aboutContent = {
  heading: 'About',
  paragraphs: [
    'I am a creative technologist exploring how data, design, and human experience come together. My work spans interactive visualizations, intelligent systems, and thoughtful digital experiences.',
    'Currently studying at Northeastern University, I bring an artistic sensibility to technical problems, finding clarity in complexity and beauty in information.',
  ],
};

export const experienceItems = [
  {
    title: 'Data Visualization',
    description: 'Interactive charts, exploratory analysis, and visual storytelling',
  },
  {
    title: 'Machine Learning',
    description: 'Predictive modeling, NLP, and intelligent retrieval systems',
  },
  {
    title: 'Creative Technology',
    description: 'UX design, prototyping, and full-stack development',
  },
  {
    title: 'Research',
    description: 'Academic projects at the intersection of AI and human experience',
  },
];
