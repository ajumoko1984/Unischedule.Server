export interface Faculty {
  id: string;
  name: string;
  departments: string[];
}

export const FACULTIES: Faculty[] = [
  {
    id: 'agriculture',
    name: 'FACULTY OF AGRICULTURE',
    departments: [
      'Agricultural Economics and Farm Management',
      'Agricultural Extension and Rural Development',
      'Agronomy',
      'Animal Production',
      'Crop Protection',
      'Home Economics and Food Science',
    ],
  },
  {
    id: 'arts',
    name: 'FACULTY OF ARTS',
    departments: [
      'Arabic',
      'Christian Studies',
      'Comparative Religious Studies',
      'English',
      'French',
      'History and International Studies',
      'Islamic Studies',
      'Linguistics',
      'Performing Arts',
      'Yoruba',
    ],
  },
  {
    id: 'communication',
    name: 'FACULTY OF COMMUNICATION AND INFORMATION SCIENCES',
    departments: ['Library and Information Science', 'Mass Communication'],
  },
  {
    id: 'education',
    name: 'FACULTY OF EDUCATION',
    departments: [
      'Arts Education',
      'Business Education',
      'Education (Agricultural Science)',
      'Education (Biology)',
      'Education (Chemistry)',
      'Education (Economics)',
      'Education (English)',
      'Education (French)',
      'Education (Geography)',
      'Education (History)',
      'Education (Mathematics)',
      'Education (Physics)',
      'Educational Management',
      'Educational Technology',
      'Guidance and Counselling',
      'Health Education',
      'Human Kinetics',
      'Library and Information Science (Education)',
      'Primary Education Studies',
      'Science Education',
      'Social Studies Education',
    ],
  },
  {
    id: 'engineering',
    name: 'FACULTY OF ENGINEERING AND TECHNOLOGY',
    departments: [
      'Agricultural Engineering',
      'Chemical Engineering',
      'Civil Engineering',
      'Electrical and Electronics Engineering',
      'Materials and Metallurgical Engineering',
      'Mechanical Engineering',
      'Water Resources and Environmental Engineering',
    ],
  },
  {
    id: 'environmental',
    name: 'FACULTY OF ENVIRONMENTAL SCIENCES',
    departments: [
      'Architecture',
      'Building',
      'Estate Management',
      'Fine and Applied Arts',
      'Geography and Environmental Management',
      'Quantity Surveying',
      'Urban and Regional Planning',
    ],
  },
  {
    id: 'law',
    name: 'FACULTY OF LAW',
    departments: ['Private and Business Law', 'Public Law'],
  },
  {
    id: 'lifesciences',
    name: 'FACULTY OF LIFE SCIENCES',
    departments: ['Biochemistry', 'Microbiology', 'Plant Biology', 'Zoology'],
  },
  {
    id: 'management',
    name: 'FACULTY OF MANAGEMENT SCIENCES',
    departments: ['Accounting', 'Business Administration', 'Finance', 'Marketing'],
  },
  {
    id: 'pharmaceutical',
    name: 'FACULTY OF PHARMACEUTICAL SCIENCES',
    departments: [
      'Clinical Pharmacy and Pharmacy Practice',
      'Pharmacognosy',
      'Pharmacology and Toxicology',
      'Pharmaceutics and Industrial Pharmacy',
      'Pharmaceutical Chemistry',
    ],
  },
  {
    id: 'physical',
    name: 'FACULTY OF PHYSICAL SCIENCES',
    departments: [
      'Chemistry',
      'Computer Science',
      'Geology and Mineral Sciences',
      'Industrial Chemistry',
      'Mathematics',
      'Physics',
      'Statistics',
    ],
  },
  {
    id: 'socialsciences',
    name: 'FACULTY OF SOCIAL SCIENCES',
    departments: [
      'Criminology and Security Studies',
      'Economics',
      'Political Science',
      'Psychology',
      'Sociology',
    ],
  },
  {
    id: 'veterinary',
    name: 'FACULTY OF VETERINARY MEDICINE',
    departments: [
      'Veterinary Anatomy',
      'Veterinary Medicine',
      'Veterinary Microbiology',
      'Veterinary Pathology',
      'Veterinary Pharmacology and Toxicology',
      'Veterinary Physiology and Biochemistry',
      'Veterinary Public Health and Preventive Medicine',
      'Veterinary Surgery and Radiology',
      'Theriogenology and Production',
    ],
  },
  {
    id: 'basicmedical',
    name: 'FACULTY OF BASIC MEDICAL SCIENCES',
    departments: ['Anatomy', 'Medical Biochemistry', 'Physiology'],
  },
  {
    id: 'clinicalsciences',
    name: 'FACULTY OF CLINICAL SCIENCES',
    departments: [
      'Medicine and Surgery (M.B.B.S. programmes including Paediatrics, Obstetrics, Surgery, Internal Medicine, etc.)',
    ],
  },
];

// Export function to get faculties list
export const getFaculties = (): Omit<Faculty, 'departments'>[] => {
  return FACULTIES.map(({ id, name }) => ({ id, name }));
};

// Export function to get departments by faculty
export const getDepartmentsByFaculty = (facultyId: string): string[] | null => {
  const faculty = FACULTIES.find((f) => f.id === facultyId);
  return faculty ? faculty.departments : null;
};

// Export function to validate faculty and department
export const isValidFacultyDepartment = (facultyId: string, department: string): boolean => {
  const faculty = FACULTIES.find((f) => f.id === facultyId);
  if (!faculty) return false;
  return faculty.departments.includes(department);
};

// Export function to get faculty name by ID
export const getFacultyNameById = (facultyId: string): string | null => {
  const faculty = FACULTIES.find((f) => f.id === facultyId);
  return faculty ? faculty.name : null;
};
