import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Container, 
  Typography, 
  Button, 
  Grid, 
  Paper,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  CircularProgress
} from '@mui/material';
import { StudentMarks, SequenceResult, TermResult, AnnualResult } from './types';
import StudentModal from './components/StudentModal';
import SubjectModal from './components/SubjectModal';
import MarksTable from './components/MarksTable';
import ResultsTable from './components/ResultsTable';
import ReportModal from './components/ReportModal';
import BulkMarksEntry from './components/BulkMarksEntry';
import { generateStudentReport, generateResultsPDF } from './utils/pdfGenerator';
import { useAuth } from './context/AuthContext';
import AuthWrapper from './components/Auth/AuthWrapper';
import { collection, doc, addDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from './firebaseConfig';

interface FirestoreStudent {
  id: string;
  name: string;
}

interface FirestoreSubject {
  id: string;
  name: string;
  total: number;
}

function App() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { currentUser, loading, logout } = useAuth();
  
  // State management
  const [students, setStudents] = useState<FirestoreStudent[]>([]);
  const [subjects, setSubjects] = useState<FirestoreSubject[]>([]);
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [bulkMarksModalOpen, setBulkMarksModalOpen] = useState(false);
  const [marks, setMarks] = useState<StudentMarks[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<keyof StudentMarks>('firstSequence');
  const [selectedResultView, setSelectedResultView] = useState<'sequence' | 'firstTerm' | 'secondTerm' | 'thirdTerm' | 'annual'>('sequence');
  const [studentComments, setStudentComments] = useState<{[key: number]: {[key: string]: string}}>({});
  const [dataLoading, setDataLoading] = useState(true);

  // Results state
  const [sequenceResults, setSequenceResults] = useState<SequenceResult[]>([]);
  const [firstTermResults, setFirstTermResults] = useState<TermResult[]>([]);
  const [secondTermResults, setSecondTermResults] = useState<TermResult[]>([]);
  const [thirdTermResults, setThirdTermResults] = useState<TermResult[]>([]);
  const [annualResults, setAnnualResults] = useState<AnnualResult[]>([]);
  
  // Statistics state
  const [sequenceClassAverage, setSequenceClassAverage] = useState<number | null>(null);
  const [firstTermClassAverage, setFirstTermClassAverage] = useState<number | null>(null);
  const [secondTermClassAverage, setSecondTermClassAverage] = useState<number | null>(null);
  const [thirdTermClassAverage, setThirdTermClassAverage] = useState<number | null>(null);
  const [annualClassAverage, setAnnualClassAverage] = useState<number | null>(null);
  const [sequencePassPercentage, setSequencePassPercentage] = useState<number | null>(null);
  const [firstTermPassPercentage, setFirstTermPassPercentage] = useState<number | null>(null);
  const [secondTermPassPercentage, setSecondTermPassPercentage] = useState<number | null>(null);
  const [thirdTermPassPercentage, setThirdTermPassPercentage] = useState<number | null>(null);
  const [annualPassPercentage, setAnnualPassPercentage] = useState<number | null>(null);

  const PASSING_MARK = 10;

  // Load data from Firestore
  useEffect(() => {
    if (!currentUser) {
      setStudents([]);
      setSubjects([]);
      setMarks([]);
      setStudentComments({});
      setDataLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setDataLoading(true);
        
        // Fetch students
        const studentsSnapshot = await getDocs(collection(db, `users/${currentUser.uid}/students`));
        const studentsData = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as FirestoreStudent[];
        setStudents(studentsData);

        // Fetch subjects
        const subjectsSnapshot = await getDocs(collection(db, `users/${currentUser.uid}/subjects`));
        const subjectsData = subjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as FirestoreSubject[];
        setSubjects(subjectsData);

        // Fetch marks and comments
        const marksSnapshot = await getDocs(collection(db, `users/${currentUser.uid}/marks`));
        const marksData = marksSnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));
        setMarks(marksData as unknown as StudentMarks[]);

        const commentsSnapshot = await getDocs(collection(db, `users/${currentUser.uid}/comments`));
        const commentsData = commentsSnapshot.docs.reduce((acc, doc) => {
          acc[Number(doc.id)] = doc.data();
          return acc;
        }, {} as {[key: number]: {[key: string]: string}});
        setStudentComments(commentsData);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  // Language handler
  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  // Student handlers
  const handleAddStudent = async (name: string) => {
    if (!currentUser) return;

    try {
      const studentRef = await addDoc(collection(db, `users/${currentUser.uid}/students`), {
        name,
        createdAt: new Date().toISOString()
      });

      const newStudent = { id: studentRef.id, name };
      setStudents(prev => [...prev, newStudent]);

      // Initialize marks for new student
      const newMarks = {
        id: studentRef.id,
        firstSequence: {},
        secondSequence: {},
        thirdSequence: {},
        fourthSequence: {},
        fifthSequence: {},
        sixthSequence: {},
      };

      await setDoc(doc(db, `users/${currentUser.uid}/marks/${studentRef.id}`), newMarks);
      setMarks(prev => [...prev, newMarks]);

    } catch (error) {
      console.error("Error adding student:", error);
    }
  };

  const handleEditStudent = async (index: number, name: string) => {
    if (!currentUser) return;

    const student = students[index];
    try {
      await updateDoc(doc(db, `users/${currentUser.uid}/students/${student.id}`), {
        name
      });

      const updatedStudents = [...students];
      updatedStudents[index] = { ...student, name };
      setStudents(updatedStudents);
    } catch (error) {
      console.error("Error updating student:", error);
    }
  };

  const handleDeleteStudent = async (index: number) => {
    if (!currentUser) return;

    const student = students[index];
    try {
      const batch = writeBatch(db);
      
      // Delete student
      batch.delete(doc(db, `users/${currentUser.uid}/students/${student.id}`));
      
      // Delete associated marks
      batch.delete(doc(db, `users/${currentUser.uid}/marks/${student.id}`));
      
      // Delete associated comments
      batch.delete(doc(db, `users/${currentUser.uid}/comments/${index}`));
      
      await batch.commit();

      setStudents(students.filter((_, i) => i !== index));
      setMarks(marks.filter((_, i) => i !== index));
      
      const updatedComments = { ...studentComments };
      delete updatedComments[index];
      setStudentComments(updatedComments);
    } catch (error) {
      console.error("Error deleting student:", error);
    }
  };

  // Subject handlers
  const handleAddSubject = async (name: string, total: number) => {
    if (!currentUser) return;

    try {
      const subjectRef = await addDoc(collection(db, `users/${currentUser.uid}/subjects`), {
        name,
        total,
        createdAt: new Date().toISOString()
      });

      const newSubject = { id: subjectRef.id, name, total };
      setSubjects(prev => [...prev, newSubject]);
    } catch (error) {
      console.error("Error adding subject:", error);
    }
  };

  const handleEditSubject = async (index: number, name: string, total: number) => {
    if (!currentUser) return;

    const subject = subjects[index];
    try {
      await updateDoc(doc(db, `users/${currentUser.uid}/subjects/${subject.id}`), {
        name,
        total
      });

      const updatedSubjects = [...subjects];
      updatedSubjects[index] = { ...subject, name, total };
      setSubjects(updatedSubjects);
    } catch (error) {
      console.error("Error updating subject:", error);
    }
  };

  const handleDeleteSubject = async (index: number) => {
    if (!currentUser) return;

    const subject = subjects[index];
    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/subjects/${subject.id}`));

      setSubjects(subjects.filter((_, i) => i !== index));
      
      // Remove the deleted subject's marks
      const updatedMarks = marks.map(studentMarks => {
        const newMarks = { ...studentMarks };
        Object.keys(newMarks).forEach(sequence => {
          if (sequence !== 'id') {
            delete newMarks[sequence as keyof StudentMarks][subject.name];
          }
        });
        return newMarks;
      });
      setMarks(updatedMarks);

      // Update marks in Firestore
      const batch = writeBatch(db);
      students.forEach((student, studentIndex) => {
        batch.update(doc(db, `users/${currentUser.uid}/marks/${student.id}`), updatedMarks[studentIndex]);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error deleting subject:", error);
    }
  };

  // Mark handlers
  const handleMarkChange = async (
    studentIndex: number,
    subject: string,
    mark: string,
    maxTotal: number
  ) => {
    if (!currentUser) return;

    const numericMark = mark === "" ? "" : Number(mark);
    if (
      mark === "" || 
      (typeof numericMark === "number" && !isNaN(numericMark) && numericMark >= 0 && numericMark <= maxTotal)
    ) {
      try {
        const student = students[studentIndex];
        const updatedMarks = {
          ...marks[studentIndex],
          [selectedSequence]: {
            ...marks[studentIndex][selectedSequence],
            [subject]: numericMark
          }
        };

        await updateDoc(doc(db, `users/${currentUser.uid}/marks/${student.id}`), updatedMarks);

        setMarks(prevMarks => {
          const newMarks = [...prevMarks];
          newMarks[studentIndex] = updatedMarks;
          return newMarks;
        });
      } catch (error) {
        console.error("Error updating mark:", error);
      }
    }
  };

  // Comment handler
  const handleCommentChange = async (
    studentIndex: number,
    sequence: string,
    comment: string
  ) => {
    if (!currentUser) return;

    try {
      const updatedComments = {
        ...studentComments[studentIndex],
        [sequence]: comment
      };

      await setDoc(doc(db, `users/${currentUser.uid}/comments/${studentIndex}`), updatedComments);

      setStudentComments(prev => ({
        ...prev,
        [studentIndex]: updatedComments
      }));
    } catch (error) {
      console.error("Error updating comment:", error);
    }
  };

  // Calculate results
  const calculateSequenceResults = () => {
    const results = students.map((student, index) => {
      let totalMarks = 0;
      let totalPossible = 0;

      subjects.forEach(subject => {
        const mark = marks[index][selectedSequence][subject.name] || 0;
        totalMarks += Number(mark);
        totalPossible += subject.total;
      });

      const average = (totalMarks / totalPossible) * 20;
      return { student: student.name, totalMarks, average };
    });

    const sortedResults = [...results].sort((a, b) => b.average - a.average);
    const resultsWithRank = sortedResults.map((result, idx) => ({
      ...result,
      rank: idx + 1
    }));

    const classAvg = results.reduce((sum, { average }) => sum + average, 0) / results.length;
    const passCount = results.filter(({ average }) => average >= PASSING_MARK).length;
    const passPerc = (passCount / results.length) * 100;

    setSequenceResults(resultsWithRank);
    setSequenceClassAverage(classAvg);
    setSequencePassPercentage(passPerc);
    setSelectedResultView('sequence');
  };

  // Calculate term results
  const calculateTermResults = () => {
    // First Term (Sequences 1 & 2)
    const firstTermResults = students.map((student, index) => {
      let totalMarks = 0;
      let totalPossible = 0;

      subjects.forEach(subject => {
        const seq1Mark = Number(marks[index].firstSequence[subject.name] || 0);
        const seq2Mark = Number(marks[index].secondSequence[subject.name] || 0);
        totalMarks += (seq1Mark + seq2Mark);
        totalPossible += (subject.total * 2);
      });

      const average = (totalMarks / totalPossible) * 20;
      return { student: student.name, totalMarks, average };
    });

    // Second Term (Sequences 3 & 4)
    const secondTermResults = students.map((student, index) => {
      let totalMarks = 0;
      let totalPossible = 0;

      subjects.forEach(subject => {
        const seq3Mark = Number(marks[index].thirdSequence[subject.name] || 0);
        const seq4Mark = Number(marks[index].fourthSequence[subject.name] || 0);
        totalMarks += (seq3Mark + seq4Mark);
        totalPossible += (subject.total * 2);
      });

      const average = (totalMarks / totalPossible) * 20;
      return { student: student.name, totalMarks, average };
    });

    // Third Term (Sequences 5 & 6)
    const thirdTermResults = students.map((student, index) => {
      let totalMarks = 0;
      let totalPossible = 0;

      subjects.forEach(subject => {
        const seq5Mark = Number(marks[index].fifthSequence[subject.name] || 0);
        const seq6Mark = Number(marks[index].sixthSequence[subject.name] || 0);
        totalMarks += (seq5Mark + seq6Mark);
        totalPossible += (subject.total * 2);
      });

      const average = (totalMarks / totalPossible) * 20;
      return { student: student.name, totalMarks, average };
    });

    // Add ranks to term results
    const sortedFirstTerm = [...firstTermResults].sort((a, b) => b.average - a.average);
    const firstTermWithRank = sortedFirstTerm.map((result, idx) => ({
      ...result,
      rank: idx + 1
    }));

    const sortedSecondTerm = [...secondTermResults].sort((a, b) => b.average - a.average);
    const secondTermWithRank = sortedSecondTerm.map((result, idx) => ({
      ...result,
      rank: idx + 1
    }));

    const sortedThirdTerm = [...thirdTermResults].sort((a, b) => b.average - a.average);
    const thirdTermWithRank = sortedThirdTerm.map((result, idx) => ({
      ...result,
      rank: idx + 1
    }));

    // Calculate annual results
    const annualResults = students.map((student, index) => {
      const firstTermAvg = firstTermResults[index].average;
      const secondTermAvg = secondTermResults[index].average;
      const thirdTermAvg = thirdTermResults[index].average;
      const finalAverage = (firstTermAvg + secondTermAvg + thirdTermAvg) / 3;

      return {
        student: student.name,
        firstTermAverage: firstTermAvg,
        secondTermAverage: secondTermAvg,
        thirdTermAverage: thirdTermAvg,
        finalAverage
      };
    });

    // Sort and add ranks to annual results
    const sortedAnnual = [...annualResults].sort((a, b) => b.finalAverage - a.finalAverage);
    const annualWithRank = sortedAnnual.map((result, idx) => ({
      ...result,
      rank: idx + 1
    }));

    // Calculate class averages and pass percentages
    const firstTermClassAvg = firstTermResults.reduce((sum, { average }) => sum + average, 0) / firstTermResults.length;
    const secondTermClassAvg = secondTermResults.reduce((sum, { average }) => sum + average, 0) / secondTermResults.length;
    const thirdTermClassAvg = thirdTermResults.reduce((sum, { average }) => sum + average, 0) / thirdTermResults.length;
    const annualClassAvg = annualResults.reduce((sum, { finalAverage }) => sum + finalAverage, 0) / annualResults.length;

    const firstTermPassCount = firstTermResults.filter(({ average }) => average >= PASSING_MARK).length;
    const secondTermPassCount = secondTermResults.filter(({ average }) => average >= PASSING_MARK).length;
    const thirdTermPassCount = thirdTermResults.filter(({ average }) => average >= PASSING_MARK).length;
    const annualPassCount = annualResults.filter(({ finalAverage }) => finalAverage >= PASSING_MARK).length;

    const firstTermPassPerc = (firstTermPassCount / firstTermResults.length) * 100;
    const secondTermPassPerc = (secondTermPassCount / secondTermResults.length) * 100;
    const thirdTermPassPerc = (thirdTermPassCount / thirdTermResults.length) * 100;
    const annualPassPerc = (annualPassCount / annualResults.length) * 100;

    // Update state
    setFirstTermResults(firstTermWithRank);
    setSecondTermResults(secondTermWithRank);
    setThirdTermResults(thirdTermWithRank);
    setAnnualResults(annualWithRank);

    setFirstTermClassAverage(firstTermClassAvg);
    setSecondTermClassAverage(secondTermClassAvg);
    setThirdTermClassAverage(thirdTermClassAvg);
    setAnnualClassAverage(annualClassAvg);

    setFirstTermPassPercentage(firstTermPassPerc);
    setSecondTermPassPercentage(secondTermPassPerc);
    setThirdTermPassPercentage(thirdTermPassPerc);
    setAnnualPassPercentage(annualPassPerc);

    // Set view to first term by default
    setSelectedResultView('firstTerm');
  };

  // Generate reports
  const handleGenerateStudentReport = (studentIndex: number) => {
    const student = students[studentIndex].name;
    generateStudentReport(
      student,
      studentIndex,
      marks[studentIndex],
      subjects.map(s => ({ name: s.name, total: s.total })),
      studentComments,
      selectedSequence,
      selectedResultView,
      firstTermResults,
      secondTermResults,
      thirdTermResults,
      annualResults,
      t
    );
  };

  const handleGenerateAllReports = () => {
    students.forEach((_, index) => handleGenerateStudentReport(index));
  };

  // Reset data
  const handleResetData = async () => {
    if (!currentUser || !window.confirm(t('confirm_reset'))) return;

    try {
      const batch = writeBatch(db);

      // Delete all students
      const studentsSnapshot = await getDocs(collection(db, `users/${currentUser.uid}/students`));
      studentsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete all subjects
      const subjectsSnapshot = await getDocs(collection(db, `users/${currentUser.uid}/subjects`));
      subjectsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete all marks
      const marksSnapshot = await getDocs(collection(db, `users/${currentUser.uid}/marks`));
      marksSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete all comments
      const commentsSnapshot = await getDocs(collection(db, `users/${currentUser.uid}/comments`));
      commentsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      // Reset local state
      setStudents([]);
      setSubjects([]);
      setMarks([]);
      setStudentComments({});
      setSequenceResults([]);
      setFirstTermResults([]);
      setSecondTermResults([]);
      setThirdTermResults([]);
      setAnnualResults([]);
      setSelectedSequence('firstSequence');
      setSelectedResultView('sequence');
    } catch (error) {
      console.error("Error resetting data:", error);
    }
  };

  // Check if there are any marks entered
  const hasMarks = marks.some(studentMarks =>
    Object.values(studentMarks[selectedSequence]).some(mark => mark !== '')
  );

  if (loading || dataLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!currentUser) {
    return <AuthWrapper />;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 3
        }}>
          <Typography 
            variant="h4" 
            component="h1"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: theme.palette.primary.main,
              fontWeight: 'bold'
            }}
          >
            <span style={{ color: theme.palette.primary.main }}>Brain</span>
            <span style={{ color: theme.palette.secondary.main }}>Board</span>
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>{t('language')}</InputLabel>
              <Select
                value={i18n.language}
                label={t('language')}
                onChange={(e) => handleLanguageChange(e.target.value)}
              >
                <MenuItem value="en">{t('english')}</MenuItem>
                <MenuItem value="fr">{t('french')}</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              color="primary"
              onClick={logout}
            >
              {t('logout')}
            </Button>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button 
              variant="contained" 
              onClick={() => setStudentsOpen(true)}
              sx={{ 
                bgcolor: theme.palette.primary.main,
                '&:hover': {
                  bgcolor: theme.palette.primary.dark,
                }
              }}
            >
              {t('students')}
            </Button>
            <Button 
              variant="contained"
              color="secondary"
              onClick={() => setSubjectsOpen(true)}
              disabled={students.length === 0}
              sx={{ 
                bgcolor: theme.palette.secondary.main,
                '&:hover': {
                  bgcolor: theme.palette.secondary.dark,
                }
              }}
            >
              {t('subjects')}
            </Button>
            <Button 
              variant="outlined" 
              color="error" 
              onClick={handleResetData}
            >
              {t('reset_data')}
            </Button>
          </Box>
        </Grid>

        {students.length > 0 && subjects.length > 0 && (
          <Grid item xs={12}>
            <Paper 
              elevation={3} 
              sx={{ 
                p: 3,
                borderRadius: 2,
                transition: 'box-shadow 0.3s ease-in-out',
                '&:hover': {
                  boxShadow: 6,
                }
              }}
            >
              <Typography variant="h6" gutterBottom>
                {t('enter_marks_comments')}
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>{t('sequence')}</InputLabel>
                <Select
                  value={selectedSequence}
                  label={t('sequence')}
                  onChange={(e) => setSelectedSequence(e.target.value as keyof StudentMarks)}
                >
                  <MenuItem value="firstSequence">{t('first_sequence')}</MenuItem>
                  <MenuItem value="secondSequence">{t('second_sequence')}</MenuItem>
                  <MenuItem value="thirdSequence">{t('third_sequence')}</MenuItem>
                  <MenuItem value="fourthSequence">{t('fourth_sequence')}</MenuItem>
                  <MenuItem value="fifthSequence">{t('fifth_sequence')}</MenuItem>
                  <MenuItem value="sixthSequence">{t('sixth_sequence')}</MenuItem>
                </Select>
              </FormControl>

              <MarksTable
                students={students.map(s => s.name)}
                subjects={subjects.map(s => ({ name: s.name, total: s.total }))}
                marks={marks}
                selectedSequence={selectedSequence}
                studentComments={studentComments}
                onMarkChange={handleMarkChange}
                onCommentChange={handleCommentChange}
              />

              <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  onClick={calculateSequenceResults}
                  disabled={!hasMarks}
                >
                  {t('calculate_results')}
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={calculateTermResults}
                  disabled={!hasMarks}
                >
                  {t('term_results')}
                </Button>
                <Button
                  variant="contained"
                  color="info"
                  onClick={() => setReportModalOpen(true)}
                  disabled={!hasMarks}
                >
                  {t('student_reports')}
                </Button>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={() => setBulkMarksModalOpen(true)}
                >
                  {t('bulk_marks_entry')}
                </Button>
              </Box>
            </Paper>
          </Grid>
        )}

        {sequenceResults.length > 0 && (
          <Grid item xs={12}>
            <Paper 
              elevation={3} 
              sx={{ 
                p: 3,
                borderRadius: 2,
                mt: 2,
                transition: 'box-shadow 0.3s ease-in-out',
                '&:hover': {
                  boxShadow: 6,
                }
              }}
            >
              <ResultsTable
                selectedResultView={selectedResultView}
                onResultViewChange={setSelectedResultView}
                sequenceResults={sequenceResults}
                firstTermResults={firstTermResults}
                secondTermResults={secondTermResults}
                thirdTermResults={thirdTermResults}
                annualResults={annualResults}
                sequenceClassAverage={sequenceClassAverage}
                firstTermClassAverage={firstTermClassAverage}
                secondTermClassAverage={secondTermClassAverage}
                thirdTermClassAverage={thirdTermClassAverage}
                annualClassAverage={annualClassAverage}
                sequencePassPercentage={sequencePassPercentage}
                firstTermPassPercentage={firstTermPassPercentage}
                secondTermPassPercentage={secondTermPassPercentage}
                thirdTermPassPercentage={thirdTermPassPercentage}
                annualPassPercentage={annualPassPercentage}
                passingMark={PASSING_MARK}
                onDownloadPDF={() => {
                  generateResultsPDF(
                    t(selectedResultView),
                    selectedResultView === 'sequence' ? sequenceResults :
                    selectedResultView === 'firstTerm' ? firstTermResults :
                    selectedResultView === 'secondTerm' ? secondTermResults :
                    selectedResultView === 'thirdTerm' ? thirdTermResults :
                    annualResults,
                    selectedResultView === 'sequence' ? sequenceClassAverage! :
                    selectedResultView === 'firstTerm' ? firstTermClassAverage! :
                    selectedResultView === 'secondTerm' ? secondTermClassAverage! :
                    selectedResultView === 'thirdTerm' ? thirdTermClassAverage! :
                    annualClassAverage!,
                    selectedResultView === 'sequence' ? sequencePassPercentage! :
                    selectedResultView === 'firstTerm' ? firstTermPassPercentage! :
                    selectedResultView === 'secondTerm' ? secondTermPassPercentage! :
                    selectedResultView === 'thirdTerm' ? thirdTermPassPercentage! :
                    annualPassPercentage!,
                    selectedResultView === 'annual',
                    t
                  );
                }}
                isDownloadDisabled={false}
              />
            </Paper>
          </Grid>
        )}
      </Grid>

      <StudentModal
        open={studentsOpen}
        onClose={() => setStudentsOpen(false)}
        students={students.map(s =>s.name)}
        onAddStudent={handleAddStudent}
        onEditStudent={handleEditStudent}
        onDeleteStudent={handleDeleteStudent}
      />

      <SubjectModal
        open={subjectsOpen}
        onClose={() => setSubjectsOpen(false)}
        subjects={subjects.map(s => ({ name: s.name, total: s.total }))}
        onAddSubject={handleAddSubject}
        onEditSubject={handleEditSubject}
        onDeleteSubject={handleDeleteSubject}
      />

      <ReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        students={students.map(s => s.name)}
        onGenerateReport={handleGenerateStudentReport}
        onGenerateAllReports={handleGenerateAllReports}
        selectedSequence={selectedSequence}
        selectedResultView={selectedResultView}
      />

      <BulkMarksEntry
        open={bulkMarksModalOpen}
        onClose={() => setBulkMarksModalOpen(false)}
        students={students.map(s => s.name)}
        subjects={subjects.map(s => ({ name: s.name, total: s.total }))}
        selectedSequence={selectedSequence}
        onSave={handleMarkChange}
      />
    </Container>
  );
}

export default App;