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
    github: 'https://github.com/sraghvi',
    linkedin: 'https://linkedin.com/in/sraghvi',
    email: 'mailto:sraghvia@gmail.com',
  },
};

export const projects = [
  {
    id: 1,
    title: 'VisProm — Interactive Wine Data Visualization',
    category: 'Data Visualization',
    year: '2026',
    tag: 'Research',
    image: '/images/visprom-cover.png',
    imageFit: 'contain',
    link: '/visprom/index.html',
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
  },
  {
    id: 3,
    title: 'Experience Design Project',
    category: 'UX / Creative Technology',
    year: '2024',
    tag: 'Design',
    image:
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80&auto=format&fit=crop',
    link: '#',
  },
];

export const aboutContent = {
  heading: 'About',
  paragraphs: [
    'I am a creative technologist exploring how data, design, and human experience come together. My work spans interactive visualizations, intelligent systems, and thoughtful digital experiences.',
    'Currently studying at Northeastern University, I bring an artistic sensibility to technical problems — finding clarity in complexity and beauty in information.',
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
