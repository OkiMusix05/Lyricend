import React, { useMemo } from 'react';
import { useState, useRef, useEffect, createContext, useContext } from 'react';
import { Center, ColorSchemeProvider, useMantineColorScheme, MantineProvider, rem, useMantineTheme, Skeleton, Container, Overlay, CloseButton, Menu, Popover } from '@mantine/core';
import { useLocalStorage, useHotkeys, useColorScheme, getHotkeyHandler, useDocumentTitle, useNetwork, useDidUpdate } from '@mantine/hooks';
import { UserPanel } from './Components/_user.tsx';
//import { SearchSongInput } from './Components/_songSearch.tsx';
import { IconSettings, IconLockOpen, IconLock, IconFile, IconFileCheck, IconFilePencil, IconTrash, IconTrashOff, IconSun, IconMoonStars, IconPlus, IconAlertHexagon, IconFileUnknown, IconHighlight, IconHighlightOff, IconPrinter, IconWifiOff, IconMoon, IconGrillFork, IconArrowBarToLeft, IconBallpen } from '@tabler/icons-react';
import { RichTextEditor } from '@mantine/tiptap';
import { useEditor, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ModalsProvider, modals } from '@mantine/modals';
import { Notifications, notifications } from '@mantine/notifications';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import {
  AppShell,
  Navbar,
  Header,
  ScrollArea,
  Box,
  Group,
  Accordion,
  Text,
  Title,
  Grid,
  Loader,
  ActionIcon,
  Tooltip,
  Button,
  Textarea,
  Input,
  Mark
} from '@mantine/core';
import { AuthenticationForm } from "./Components/auth.jsx"
import { auth, db } from './config/firebase'
import { onAuthStateChanged } from "firebase/auth";
import { getDocs, collection, setDoc, deleteDoc, doc, query, where, onSnapshot, QuerySnapshot, addDoc } from 'firebase/firestore'
import { UnstyledButton } from '@mantine/core';
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { NotFoundPage } from './Pages/404.tsx';
import jsPDF from 'jspdf';
import { HomePage } from './Pages/Home.tsx';
import { v4 } from 'uuid';

import './App.css';
//import { isEditable } from '@testing-library/user-event/dist/utils/index.js';

//const mql = window.matchMedia(`(min-width: 800px)`);
//Context
export const isSavedCtx = createContext({});
//export const songListCtx = createContext({});

//const API_KEY = '/1gJtFMabYLBlll1mYo+Og==m9WXbzQarLTMvbLI';
//let numOfRhymes = 8;

export default function App() {
  const [colorScheme, setColorScheme] = useLocalStorage({ key: 'mantine-color-scheme', defaultValue: 'dark'});

  const toggleColorScheme = (value) =>
    setColorScheme(value || (colorScheme === 'dark' ? 'light' : 'dark'));

  // General Hotkeys
  useHotkeys([['mod+J', () => toggleColorScheme()]]);
  return (
    <>
      <ColorSchemeProvider colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
        <MantineProvider theme={{ colorScheme }} withGlobalStyles withNormalizeCSS>
          <Notifications limit={2} />
          <ModalsProvider>
            <BrowserRouter>
              <RoutesManager />
            </BrowserRouter>
          </ModalsProvider>
        </MantineProvider>
      </ColorSchemeProvider>
    </>
  );
}

function RoutesManager() {
  return (
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function MainApp() {
  //Interesting useless things I did cause I like procrastinating
  const [pageTitle, setPageTitle] = useState('');
  useDocumentTitle(pageTitle);
  const [wifi, setWifi] = useState(true);
  const networkStatus = useNetwork();

  //Hotkeys
  useHotkeys([['mod+Z', () => editor.commands.undo()]]);
  useHotkeys([['mod+shift+Z', () => editor.commands.redo()]]);
  useHotkeys([['mod+shift+H', () => { toggleHighlights() }]]);
  useHotkeys([['mod+S', () => handleSave()],
              ['mod+shift+J', () => handleCreate()]]);
  const toggleHighlights = () => {
    let html = editor.getHTML();

    if (html.includes('</mark>')) {
      let newHtml = html.replace(/<mark[^>]*>/g, '').replace(/<\/mark>/g, '');
      editor.commands.clearContent();
      editor.commands.setContent(newHtml);
    } else {
      highlighterF(editor.getText(), html);
    }
  }

  //App Theme
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  //const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [opened, setOpened] = useState(false);
  //For the Rhyming Functionality
  const [words, setWords] = useState([]);
  const [text, setText] = useState('');
  const [syllableList, setSyllableList] = useState([]);
  const timerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rhymes, setRhymes] = useState({ perfectRhyme: [], nearRhyme: [] });
  const [numOfRhymes, setNumOfRhymes] = useLocalStorage({ key: 'num-of-rhymes', defaultValue: 8 });
  const [isSongListLoaded, setIsSongListLoaded] = useState(false);
  const [openID, setOpenId] = useState('');
  // Key presses
  const [isShift, setIsShift] = useState(false);

  //Change RGBA colors to RGB as if it was displayed against a white background function
  function convertRGBAtoRGB(rgbaColor) {
    const colorValues = rgbaColor.replace(/\s+/g, '').substring(5).slice(0, -1);
    const [red, green, blue, alpha] = colorValues.split(',');

    const rgbRed = Math.round((1 - alpha) * 255 + alpha * parseInt(red.trim()));
    const rgbGreen = Math.round((1 - alpha) * 255 + alpha * parseInt(green.trim()));
    const rgbBlue = Math.round((1 - alpha) * 255 + alpha * parseInt(blue.trim()));

    return `rgb(${rgbRed}, ${rgbGreen}, ${rgbBlue})`;
  }
  //Generate PDF from the lyrics in the editor
  const generatePDF = () => {
    const pdf = new jsPDF();
    const html = editor.getHTML();
    var title = /<h2>(.*?)<\/h2>/g.exec(html)[1];
    var _username = auth.currentUser.displayName;
    //Handles all the styling for the pdf - Force the text to black and align center
    const pdfHtml = html
      .replace( //Adds a subtitle with the username
        /<h2>(.*?)<\/h2>/g,
        `<h2 style="color: black; text-align: center;">$1</h2><p style="color: #999; text-align: right; margin-top: -1.5rem;">${'@' + _username}</p>`
      )
      .replace(/<h3>/g, '<h3 style="color: black; text-align: center;">')
      .replace(/<p>/g, '<p style="color: black; text-align: center;">')
      .replace( //Fixes the highlighter colors in the pdf
        /<mark([^>]*)style="([^"]*)background-color:\s*(rgba?\([^"]*\));?([^"]*)">(.*?)<\/mark>/g,
        (_, tagAttrs, styleAttrs, rgbaColor, remainingAttrs, content) => {
          const rgbColor = convertRGBAtoRGB(rgbaColor);
          const newStyleAttrs = `${styleAttrs}background-color: ${rgbColor}; color: black;${remainingAttrs}`;
          return `<mark${tagAttrs}style="${newStyleAttrs}">${content}</mark>`;
        }
      );

    // Add watermark as footer
    const watermarkFontSize = 10; // Watermark font size
    const watermarkTextWidth = pdf.getStringUnitWidth("Made with Lyrciend ©") * watermarkFontSize / pdf.internal.scaleFactor;
    const margin = 15; // Margin between watermark and content
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      const pageHeight = pdf.internal.pageSize.getHeight();
      const watermarkY = pageHeight - 10;
      pdf.setTextColor('#888');
      pdf.setFontSize(watermarkFontSize);
      pdf.text("Made with Lyrciend ©", margin, watermarkY, { align: "left", maxWidth: pdf.internal.pageSize.getWidth() - margin - watermarkTextWidth });
    }

    pdf.html(pdfHtml, {
      callback: function (pdf) {
        // Save the PDF
        pdf.save(title);
      },
      x: 15,
      y: 15,
      width: 170,
      windowWidth: 650
    });
  }

  //Advanced Settings
  const [advancedChecked, setAdvancedChecked] = useLocalStorage({ key: 'advanced-settings', defaultValue: false });

  //Accordion Control
  const [accValue, setAccValue] = useState("");

  // Highliting Functionality
  const [alreadySearched, setAlreadySearched] = useState([]);
  const [apiCounter, setApiCounter] = useState(0);
  const [rhymesArray, setRhymesArray] = useState([]);
  const [colorArray, setColorArray] = useState([]);
  var colors = ['#FFA8A8', '#FAA2C1', '#E599F7', '#9775FA', '#748FFC', '#4DABF7', '#3BC9DB', '#38D9A9', '#69DB7C', '#A9E34B', '#FFD43B', '#FFA94D'];
  const highlighterF = async (text, html) => {
    if(!isShift) { // That is, normally
      setIsLoading(true);
      let title = /<h2>(.*?)<\/h2>/g.exec(html)[1];
      var _text = text.replace(/\s*\n\s*/g, ' ').replace(title, '');
      const words = _text.replace(/[.?!,_\-:;]/g, '').toLowerCase().split(' ');
      var localAlreadySearched = [...alreadySearched]; // Store updated state value
      var localRhymesArray = [...rhymesArray];
      var localApiCounter = apiCounter;
      var localColorArray = [...colorArray];
  
      for (let i = 0; i < words.length; i++) {
        const word = words[i].replace(/[.,!?_\-:;]/, '');
        let wordSet = [];
  
        if (
          !localAlreadySearched.includes(word) &&
          word.length > 1 &&
          word.toLowerCase() !== 'the' &&
          word.toLowerCase() !== 'verse' &&
          word.toLowerCase() !== 'pre' &&
          word.toLowerCase() !== 'chorus' &&
          word.toLowerCase() !== 'bridge'
        ) {
          try {
            let breakFlag = false;
            const rhymeUrl = `https://api.datamuse.com/words?rel_rhy=${word}`;
            const response = await fetch(rhymeUrl);
            const responseJson = await response.json();
            const apiWordList = responseJson.map(({ word }) => word);
            wordSet.push(word);
            localAlreadySearched.push(word);
  
            for (let j = 0; j < apiWordList.length; j++) {
              const apiWord = apiWordList[j].toLowerCase();
              if (words.includes(apiWord)) {
                wordSet.push(apiWord);
                for (let k = 0; k < localRhymesArray.length; k++) {
                  if (localRhymesArray[k].includes(apiWord)) {
                    localRhymesArray[k].push(word);
                    breakFlag = true;
                    wordSet = [];
                    break;
                  }
                }
                if (!localAlreadySearched.includes(apiWord)) {
                  localAlreadySearched.push(apiWord);
                }
                if (breakFlag) {
                  break
                }
              }
            }
  
            if (wordSet.length > 1) {
              localRhymesArray.push(wordSet);
            }
  
            localApiCounter += 1;
          } catch {
            throw new Error('ERROR!!');
          }
        }
      }
      var opacity = dark ? '40' : '59'; //Makes the color be 25% opacity if dark theme and 35% opacity if light theme
      for (let i = 0; i < localRhymesArray.length; i++) {
        if (localRhymesArray.length > localColorArray.length) {
          var color = colors.splice(Math.floor(Math.random() * (colors.length)), 1);
          localColorArray.push(color[0]);
        }
        for (let j = 0; j < localRhymesArray[i].length; j++) {
          var index = html.toLowerCase().indexOf(localRhymesArray[i][j].toLowerCase());
          var postIndex = index + localRhymesArray[i][j].length;
          var replaceWord = html.slice(index, postIndex);
          //console.log(index + " : " + postIndex);
          var output = html.replaceAll(RegExp("\\b" + replaceWord + "\\b", "g"), `<mark style="background-color: ${localColorArray[i] + opacity}">${replaceWord}</mark>`);
          html = output;
        }
      }
      setRhymesArray(localRhymesArray);
      setApiCounter(localApiCounter);
      setAlreadySearched(localAlreadySearched);
      editor?.commands.clearContent();
      editor?.commands.insertContent(html);
      setColorArray(localColorArray);
      setIsLoading(false);
    } else { // This happens when the un-highlight button is pressed
      let html = editor.getHTML();
      html = html.replace(/<mark.*?>/g, '');
      html = html.replace(/<\/mark>/g, '');
      editor.commands.clearContent();
      editor.commands.insertContent(html);
    }
  };
  useEffect(() => {
    console.log(apiCounter);
  }, [apiCounter]);

  // Network Warnings
  useDidUpdate(() => {
    if(!networkStatus.online) {
      setWifi(false);
      setPageTitle('Lyricend | Offline');
    } else if(networkStatus.online) {
      setWifi(true);
      setPageTitle('Lyricend');
    }
  }, [networkStatus]);
  
  //Master Rhyme Function - There used to be 2 functions but now it's just one with the common logic
  const rhymeF = async (word, where) => {
    let look;
    if (where === 'update') {
      const lines = word.split('\n');
      const currentLine = lines[lines.length - 1].trim().split(' ');
      look = currentLine[currentLine.length - 1].replace(/[.,!?]+$/, '');;
    }
    else if (where === 'select') {
      look = word.replace(/[.,!?]+$/, '');
    }
    setIsLoading(true);
    try {
      const perfectRhymeUrl = `https://api.datamuse.com/words?rel_rhy=${look}`;
      const nearRhymeUrl = `https://api.datamuse.com/words?rel_nry=${look}`;

      const [response1, response2] = await Promise.all([
        fetch(perfectRhymeUrl),
        fetch(nearRhymeUrl)
      ]);

      if ((!response1 || !response1.ok) && (!response2 || !response2.ok)) {
        throw new Error('Request failed');
      }

      const responseJson1 = await response1.json();
      const responseJson2 = await response2.json();

      const perfectRhymeWords = responseJson1.length > 0
        ? responseJson1
          .sort((a, b) => b.score - a.score)
          .map(({ word }) => word)
          .slice(0, numOfRhymes)
        : ['None Found'];

      const nearRhymeWords = responseJson2.length > 0
        ? responseJson2
          .sort((a, b) => b.score - a.score)
          .map(({ word }) => word)
          .slice(0, numOfRhymes)
        : ['None Found'];

      setRhymes({
        perfectRhyme: perfectRhymeWords,
        nearRhyme: nearRhymeWords
      });
    } catch (error) {
      console.error('Error:', error);
      setRhymes({ perfectRhyme: ['None found'], nearRhyme: ['None found'] });
    } finally {
      setIsLoading(false);
      if (where === 'select') {
        setAccValue('ryms');
      }
    }
  };
  //Means-Like Function: Essentialy a reverse dictionary
  const [searchWord, setSearchWord] = useState('');
  const [meansLikeWords, setMeansLikeWords] = useState([]);
  const [isSearchButtonClicked, setIsSearchButtonClicked] = useState(false);
  const wordFind = async () => {
    setIsSearchButtonClicked(true);
    setIsLoading(true);
    try {
      const encodedSearchWord = encodeURIComponent(searchWord);
      const response = await fetch(`https://api.datamuse.com/words?ml=${encodedSearchWord}`);
      if (!response.ok) {
        throw new Error('Request failed');
      }
      const responseJson = await response.json();
      const searchedWords = responseJson.length > 0
        ? responseJson
          .sort((a, b) => b.score - a.score) // Sort by higher score first
          .map(({ word }) => word)
          .slice(0, numOfRhymes)
        : ['None Found'];
      setMeansLikeWords(searchedWords);
    } catch (error) {
      console.error('Error:', error);
      setMeansLikeWords(['None found']);
    } finally {
      setIsLoading(false);
    }
  };

  //Synonims, Antonyms, and Homophones Master Function
  const [selectedWord, setSelectedWord] = useState('');
  const [synonyms, setSynonyms] = useState([]);
  const [antonyms, setAntonyms] = useState([]);
  const [homophones, setHomophones] = useState([]);
  async function thesaurusF(word, type) {
    setIsLoading(true);
    setSelectedWord(word.trim().split(" ").pop().replace(/[.,!?]+$/, ''));
    try {
      const fetchUrl = `https://api.datamuse.com/words?rel_${type}=${word.replace(/[.,!?]+$/, '')}`;
      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error('Request failed');
      }
      const responseJson = await response.json();
      const list = responseJson.length > 0
        ? responseJson.map(({ word }) => word)
        : ['None Found'];
      if (type === 'syn') {
        setSynonyms(list);
      } else if (type === 'ant') {
        setAntonyms(list);
      } else if (type === 'hom') {
        setHomophones(list);
      }
    } catch (error) {
      console.error('Error:', error);
      setSynonyms(['None found']);
      setAntonyms(['None found']);
      setHomophones(['None found']);
    } finally {
      setIsLoading(false);
      setAccValue(type);
    }
  }

  //Dictionary Function
  const [defList, setDefState] = useState([]);
  async function DefineF(word) {
    setIsLoading(true);
    setSelectedWord(word.trim().split(" ").pop().replace(/[.,!?]+$/, ''));
    try {
      const definitionUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim().split(" ").pop().replace(/[.,!?]+$/, ''))}`;

      const response = await fetch(definitionUrl);

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const [responseJson] = await response.json();

      const definitions = responseJson?.meanings?.[0]?.definitions || ['None Found'];

      setDefState(definitions);
    } catch (error) {
      console.error('Error:', error);
      setDefState(['None Found']);
    } finally {
      setIsLoading(false);
      setAccValue('def')
    }
  }

  //Authentication
  const [isSigned, setIsSigned] = useState(false);
  const [uid, setUID] = useState('');
  useEffect(() => {
    const authStateListener = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsSigned(true);
        setUID(user.uid);
      } else {
        setUID('');
        setIsSigned(false);
      }
    });
    return () => {
      authStateListener();
    };
  }, []);

  // Key logic checker
  useEffect(() => {
    const keyDownHandler = (event) => {
      if (event.key === 'Shift') {
        event.preventDefault();
        setIsShift(true);
      }
    };
  
    const keyUpHandler = (event) => {
      if (event.key === 'Shift') {
        setIsShift(false);
      }
    };
  
    document.addEventListener('keydown', keyDownHandler);
    document.addEventListener('keyup', keyUpHandler);
  
    return () => {
      document.removeEventListener('keydown', keyDownHandler);
      document.removeEventListener('keyup', keyUpHandler);
    };
  }, []);

  //FireStore Data Base
  const [songList, setSongList] = useState([]);
  //Filter through the songs
  const [filterQuery, setFilterQuery] = useState('');
  const filteredSongList = useMemo(() => {
    return songList.filter(song => {
      return song.title.toLowerCase().includes(filterQuery.toLowerCase());
    })
  }, [songList, filterQuery]);
  const lyricsCollectionRef = collection(db, "Lyrics");
  //Retrieve SongList if the user is signed - an alternative to getSongList();
  useEffect(() => {
    try {
      const userSongs = query(lyricsCollectionRef, where("_uid", "==", uid));
      const unsubscribe = onSnapshot(userSongs, (querySnapshot) => {
        const _songs = [];
        querySnapshot.forEach((doc) => {
          _songs.push({ ...doc.data(), id: doc.id });
        });
        setSongList(_songs);
        setIsSongListLoaded(true);
      });
      if (!isSigned) {
        unsubscribe();
        //Verified that it is actually unsubsribing.
        // setIsSongListLoaded(false);
      }
    } catch (error) {
      console.error(error);
    }
  }, [isSigned]);

  useEffect(() => {
    if (isSigned === true) {
      /*getSongList();*/
      setEditable(true);
    }
    else {
      setSongList([]);
      editor?.commands.setContent('');
      setEditable(false);
    }
    console.log("Changed isSigned")
  }, [isSigned])

  //For Saving files
  const [isSaved, setIsSaved] = useState(false);
  //Notification for succesful save
  const succSave = (key) => {
    setIsSaved(true);
    notifications.show({
      title: '"' + key + '" was succesfully saved!',
      message: 'Well done with this one!',
      styles: (theme) => ({
        root: {
          backgroundColor: theme.colors.white,
          borderColor: theme.colors.teal,

          '&::before': { backgroundColor: theme.colors.teal[6] },
        },
      }),
    });
  }
  //Notification for unsuccesful save
  const nonSave = (error) => {
    setIsSaved(false)
    console.log("There was an Error when saving: " + error)
    notifications.show({
      title: 'Error on Save!!!',
      message: `Error: ${error}`,
      styles: (theme) => ({
        root: {
          backgroundColor: theme.colors.white,
          borderColor: theme.colors.red,

          '&::before': { backgroundColor: theme.colors.red[6] },
        },
      }),
    });
  }
  //Logic for saving the songs
  const handleSave = async () => {
    if (editor.getText !== '') {
      const regex = /<h2>(.*?)<\/h2>/;
      const value = editor?.getHTML();
      const matches = regex.exec(value);
      const key = matches ? matches[1] : null;
      const rhymes = rhymesArray.map(function (subArray) {
        return subArray.join(';');
      });
      if (key === null) {
        editor?.commands.insertContentAt(0, '<h2>Add a title first</h2>');
        nonSave('No Title');
      } else {
        if (openID !== '') {
          try {
            console.log(uid);
            await setDoc(doc(db, "Lyrics", openID), {
              title: key,
              lyrics: value,
              _uid: uid,
              _rhymesArray: rhymes,
              _alreadySearched: alreadySearched,
              _colorArray: colorArray,
            });
            succSave(key);
            setPageTitle(`Lyricend / ${key}`);
          } catch (error) {
            nonSave(error.code);
            throw error;
          }
        } else if (openID === '') {
          try {
            const docRef = await addDoc(collection(db, "Lyrics"), {
              title: key,
              lyrics: value,
              _uid: uid,
              _rhymesArray: rhymes,
              _alreadySearched: alreadySearched,
              _colorArray: colorArray,
            });
            succSave(key);
            setPageTitle(`Lyricend / ${key}`);
            setOpenId(docRef.id);
          } catch (error) {
            nonSave(error.code);
            throw error;
          }
        }
      }
    }

  };
  /*useEffect(() => {
    console.log("openID: " + openID)
  }, [openID]);*/

  //OpenFile
  const handleOpen = async (uid, title, lyrics, id, rhymes, searched, colors) => {
    await editor.commands.clearContent();
    const rArray = rhymes.map(function (subArray) {
      return subArray.split(';');
    });
    setRhymesArray(rArray);
    setAlreadySearched(searched);
    setColorArray(colors);
    setApiCounter(0);
    if (editor.isEditable === true) {
      setOpenId(id);
      editor.commands.insertContent(lyrics);
      setIsSaved(true);
      notifications.show({
        title: '"' + title + '" was opened',
        message: 'Good luck!',
        styles: (theme) => ({
          root: {
            backgroundColor: theme.colors.white,
            borderColor: theme.colors.red,

            '&::before': { backgroundColor: theme.colors.teal[6] },
          },
        }),
      });
      setFilterQuery('');
      setPageTitle(`Lyricend / ${title}`);
    } else {
      notifications.show({
        title: 'Editor is Locked',
        message: 'Unlock the editor to open "' + title + '"',
      })
    }
  }
  //Create File
  const handleCreate = () => {
    setOpenId('');
    editor?.commands.clearContent();
    editor?.commands.insertContent(`<h2>Untitled ${Math.trunc(Math.random() * 100000)}</h2>`);
    editor?.commands.enter();
    editor?.commands.focus();
    setRhymesArray([]);
    setApiCounter(0);
    setAlreadySearched([]);
    setColorArray([]);
    notifications.show({
      title: 'New song created!',
      message: 'Good Luck!',
      styles: (theme) => ({
        root: {
          '&::before': { backgroundColor: theme.colors.teal[6] },
        },
      }),
    });
    setPageTitle(`Lyricend / Untitled New`);
  }
  //Delete File
  const handleDelete = async (sid, title) => {
    const deletedSong = doc(db, "Lyrics", sid)
    await deleteDoc(deletedSong);
    editor?.commands.clearContent();
    /*getSongList();*/
    notifications.show({
      title: 'Song Deleted',
      message: 'Your song "' + title + '" was succesfully deleted!',
    });
    setOpenId('');
    setRhymesArray([]);
    setApiCounter(0);
    setAlreadySearched([]);
    setColorArray([]);
    setPageTitle(`Lyricend`);
  }
  //Verification Modals
  const openDeleteModal = (sid, title) =>
    modals.openConfirmModal({
      title: 'Delete Song Lyrics',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete your song "{title}"? This action is destructive and you will not be able to recover it.
        </Text>
      ),
      labels: { confirm: 'Delete Song', cancel: "No, don't delete it" },
      confirmProps: { color: 'red' },
      onCancel: () => {
        notifications.show({
          title: 'Song not deleted',
          message: 'Your song "' + title + '" is still safe!',
        })
      },
      onConfirm: () => handleDelete(sid, title),
    });
  const syllableCounter = (word) => {
    word = word.toLowerCase();
    if(word.length <= 3) { return 1; }
      word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
      word = word.replace(/^y/, '');
      return word.match(/[aeiouy]{1,2}/g).length;
  }
  const extractLinesAndCountSyllables = (text) => {
    setSyllableList([]);
    let Text = text.replace(/<mark.*?>/g, '');
    Text = Text.replace(/<\/mark>/g, '');

    const parser = new DOMParser();
    const doc = parser.parseFromString(Text, 'text/html');
    const elements = Array.from(doc.body.children);

    let linesArray = elements.map((element) => {
      if (element.tagName === 'H2') {
        return '-1';
      } else if (element.tagName === 'H3') {
        return '0';
      } else if (element.tagName === 'P') {
        return element.textContent.trim() || '-2';
      } else {
        return '0';
      }
    });
    linesArray = linesArray.map((l) => {
      if(l == '0') {
        return 0;
      } else if(l == '-1') {
        return -1;
      } else if (l == '-2') {
        return -2;
      } else {
        let lineSyllables = 0;
        const words = l.split(' ');
        for(let i = 0; i < words.length; i++) {
          lineSyllables += syllableCounter(words[i]);
        }
        return lineSyllables;
      }
    });
    setSyllableList(linesArray);
  };
  const [editable, setEditable] = useState(true);
  const editor = useEditor({
    editable,
    extensions: [StarterKit, Placeholder.configure({ placeholder: 'Click + to create, or open a song' }), History, Highlight.configure({ multicolor: true })],
    content: '',
    onSave: (editorContent) => {
      setText(editorContent);
    },
    onUpdate: ({ editor }) => {
      setIsSaved(false);
      let html = editor.getHTML();
      //let apiText = html.replaceAll('</p><p>', '\n').replace('<p>', '').replace('</p>', '')
      let apiText = editor.getText();
      // send the content to an API here
      if (apiText !== '') {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
          if (accValue === 'ryms') {
            rhymeF(apiText, 'update');
          }
        }, 1500);
      }
      extractLinesAndCountSyllables(html);
    },
  });

  useEffect(() => {
    if (!editor) {
      return undefined
    }

    editor.setEditable(editable);
  }, [editor, editable])

  if (!editor) {
    return null
  }

  const editToggle = () => {
    //console.log(editor.isEditable)
    if (editor.isEditable === true) {
      setEditable(false);
    } else if (editor.isEditable === false) {
      setEditable(true);
    }
  }

  const scaleX = { // Transition
    in: { opacity: 1, transform: 'scaleX(1)' },
    out: { opacity: 0, transform: 'scaleX(0)' },
    common: { transformOrigin: 'right' },
    transitionProperty: 'transform, opacity',
  };

  return (
    <AppShell
      padding="md"
      fixed={false}
      navbarOffsetBreakpoint="sm"
      height="100%"
      header={
        <Header height={60}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Title order={1} ta="center" style={{ WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none'}}>Lyricend</Title>
            {!wifi ? <><Title style={{ WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none'}}>{String.fromCharCode(160)}</Title><IconWifiOff size="2rem"/></> : <></>}
          </div>
        </Header>
      }
      navbar={
        <Navbar p="xs" hiddenBreakpoint="sm" hidden={!opened} width={{ sm: 250, lg: 300 }}>
          <Navbar.Section mt="xs">
            <Box
              sx={(theme) => ({
                paddingLeft: theme.spacing.xs,
                paddingRight: theme.spacing.xs,
                paddingBottom: theme.spacing.lg,
                borderBottom: `${rem(1)} solid ${theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[2]
                  }`,
              })}
            >
              <Group position="apart">
                <Title order={3} style={{ WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none'}}>Projects</Title>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  { editor.getText() === '' || isShift ?
                  <Tooltip label="New Song" color='blue' withArrow position="bottom" openDelay={1000}>
                    <ActionIcon variant="default" onClick={() => {
                      if (editor.getText() === '' || isSaved) {
                        handleCreate();
                      } else {
                        modals.openConfirmModal({
                          title: 'The current song has not been saved!',
                          centered: true,
                          children: (
                            <Text size="sm">
                              Do you want to create a new song?
                            </Text>
                          ),
                          labels: { confirm: 'Save', cancel: "Create anyways" },
                          confirmProps: { color: 'teal' },
                          onCancel: () => {
                            handleCreate();
                          },
                          onConfirm: async () => {
                            await handleSave();
                            await handleCreate();
                            /*notifications.show({
                              title: '"' + editor?.getHTML()?.replaceAll('</p><p>', '\n')?.replace('<p>', '')?.replace('</p>', '')?.replaceAll('<h2>', '')?.replaceAll('</h2>', '\n').split('\n')[0].trim() + '" saved!',
                              message: 'New song now created. Good luck!',
                            })*/
                          },
                        });
                      }
                    }} style={{ marginRight: '0.5rem' }} size={30}><IconPlus size="1rem" /></ActionIcon>
                  </Tooltip>
                  : (<></>)}
                  {editor.getText() !== '' && !isShift ? (<Tooltip label="Save" color='blue' withArrow position="bottom" openDelay={1000}>
                    <ActionIcon variant="default" onClick={() => handleSave()} style={{ marginRight: '0.5rem' }} size={30}>
                      {isSaved === true ? <IconFileCheck size="1rem" color="teal" /> : <IconFile size="1rem" />}
                    </ActionIcon>
                  </Tooltip>) : (<></>)}
                </div>
              </Group>
            </Box>
          </Navbar.Section>
          <Navbar.Section grow component={ScrollArea} mx="-xs" px="xs">
            <Box py="md">
              {filteredSongList.length !== 0 ? filteredSongList.map((song) => (
                <UnstyledButton key={song.id}
                  sx={(theme) => ({
                    display: 'block',
                    width: '100%',
                    padding: theme.spacing.xs,
                    borderRadius: theme.radius.sm,
                    color: theme.colorScheme === 'dark' ? theme.colors.dark[0] : theme.black,

                    '&:hover': {
                      backgroundColor:
                        theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[0],
                    },
                    '&:hover .deleteIcon': {
                      display: 'block',
                    },
                  })} onClick={() => {
                    let currentTitle = editor?.getHTML()?.replaceAll('</p><p>', '\n')?.replace('<p>', '')?.replace('</p>', '')?.replaceAll('<h2>', '')?.replaceAll('</h2>', '\n').split('\n')[0].trim();
                    if (isSaved || editor.getText() === '') {
                      handleOpen(song._uid, song.title, song.lyrics, song.id, song._rhymesArray, song._alreadySearched, song._colorArray);
                    } else {
                      modals.openConfirmModal({
                        title: 'Are you sure?',
                        centered: true,
                        children: (
                          <Text size="sm">
                            Are you sure you don't want to save "{currentTitle}" before opening "{song.title}"? If not, changes won't be saved.
                          </Text>
                        ),
                        labels: { confirm: 'Save', cancel: "Open anyways" },
                        confirmProps: { color: 'teal' },
                        onCancel: () => {
                          handleOpen(song._uid, song.title, song.lyrics, song.id, song._rhymesArray, song._alreadySearched, song._colorArray);
                          notifications.show({
                            title: '"' + song.title + '" opened',
                            message: 'Changes to "' + currentTitle + '" not saved',
                            styles: (theme) => ({
                              root: {
                                backgroundColor: theme.colors.white,
                                borderColor: theme.colors.red,

                                '&::before': { backgroundColor: theme.colors.pink[6] },
                              },
                            }),
                          })
                        },
                        onConfirm: async () => {
                          await handleSave();
                          await handleOpen(song._uid, song.title, song.lyrics, song.id, song._rhymesArray, song._alreadySearched, song._colorArray);
                          notifications.show({
                            title: '"' + currentTitle + '" saved!',
                            message: '"' + song.title + '" now opened.',
                          })
                        },
                      });
                    }
                  }}
                >
                  <Group sx={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Group>
                      <IconFilePencil size="1rem" />
                      <Text size="sm" lineClamp={1}>{song.title}</Text>
                    </Group>
                    <ActionIcon
                      variant="subtle"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (editor.isEditable) {
                          openDeleteModal(song.id, song.title)
                        }
                        else {
                          notifications.show({
                            title: 'Can\'t delete the song',
                            message: 'You can\'t delete a song while the editor is locked',
                            styles: (theme) => ({
                              root: {
                                backgroundColor: theme.colors.white,
                                borderColor: theme.colors.red,

                                '&::before': { backgroundColor: theme.colors.pink[6] },
                              },
                            }),
                          })
                        }
                      }}
                      size={30}
                      sx={{ display: 'none' }} // Initially hide the ActionIcon
                      className="deleteIcon"
                    >
                      <Center>
                        {editor.isEditable === true ? (
                          <IconTrash size="1rem" />
                        ) : (
                          <IconTrashOff size="1rem" color="gray" />
                        )}
                      </Center>
                    </ActionIcon>
                  </Group>
                </UnstyledButton>
              )) : (
                <>
                  {filterQuery === '' ? (
                    <>
                      {!isSongListLoaded ? (
                        <div sx={(theme) => ({
                          display: 'block',
                          width: '100%',
                          padding: theme.spacing.xs,
                          borderRadius: theme.radius.sm,
                          color: theme.colorScheme === 'dark' ? theme.colors.dark[0] : theme.black,

                          '&:hover': {
                            backgroundColor:
                              theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[0],
                          },
                          '&:hover .deleteIcon': {
                            display: 'block',
                          }
                        })}>
                          <Group sx={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Skeleton height="2rem" mt={6} radius="m" />
                          </Group>
                        </div>
                      ) : (
                        <UnstyledButton
                          style={{ cursor: 'auto', }}
                          sx={(theme) => ({
                            display: 'block',
                            width: '100%',
                            padding: theme.spacing.xs,
                            borderRadius: theme.radius.sm,
                            color: theme.colorScheme === 'dark' ? theme.colors.dark[0] : theme.black,
                          })}><Group sx={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Group><IconFileUnknown size="1rem" /><Text size="sm">Song List Empty</Text></Group>
                          </Group></UnstyledButton>
                      )}
                    </>
                  ) : (
                    <UnstyledButton
                      style={{ cursor: 'auto', }}
                      sx={(theme) => ({
                        display: 'block',
                        width: '100%',
                        padding: theme.spacing.xs,
                        borderRadius: theme.radius.sm,
                        color: theme.colorScheme === 'dark' ? theme.colors.dark[0] : theme.black,
                      })}><Group sx={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Group><IconAlertHexagon size="1rem" /><Text size="sm">No songs found</Text></Group>
                      </Group></UnstyledButton>)}
                </>)}
            </Box>
          </Navbar.Section>
          <Navbar.Section>
            <Input
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.currentTarget.value)}
              placeholder="Search in your songs..."
              dropdownPosition="top"
              rightSection={
                <CloseButton
                  aria-label="Clear input"
                  onClick={() => setFilterQuery('')}
                  style={{ display: filterQuery ? undefined : 'none' }}
                />}
            />
            <isSavedCtx.Provider value={{ isSaved, setIsSaved, editor, numOfRhymes, setNumOfRhymes, advancedChecked, setAdvancedChecked, toggleColorScheme, dark }}>
              <UserPanel />
            </isSavedCtx.Provider>
          </Navbar.Section>
        </Navbar>
      }
      aside={
        <Navbar p="xs" hiddenBreakpoint="sm" hidden={!opened} width={{ sm: 250, lg: 300 }}>
          <Navbar.Section mt="xs">
            <Box
              sx={(theme) => ({
                paddingLeft: theme.spacing.xs,
                paddingRight: theme.spacing.xs,
                paddingBottom: theme.spacing.lg,
                borderBottom: `${rem(1)} solid ${theme.colorScheme === 'dark'
                  ? theme.colors.dark[4]
                  : theme.colors.gray[2]
                  }`,
              })}
            >
              <Group position="apart">
                <Title order={3} style={{ WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none'}} >Tools {isLoading && <Loader color="pink" variant="dots" size="sm" />}{' '}</Title>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip label={!isShift ? "Highlight" : "Un-highligh"} color="blue" withArrow position="bottom" openDelay={1000}>
                    <ActionIcon
                      variant="default"
                      onClick={() => highlighterF(editor.getText(), editor.getHTML())}
                      title="Toggle color scheme"
                      style={{ marginRight: '0.5rem' }}
                    >
                      {!isShift ? <IconHighlight size="1.1rem" /> : <IconHighlightOff size="1.1rem" />}
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={editor.isEditable ? 'Lock' : 'Unlock'} color="blue" withArrow position="bottom" openDelay={1000}>
                    <ActionIcon
                      variant="default"
                      onClick={editToggle}
                      size={30}
                      style={{ marginRight: '0.5rem' }}
                    >
                      {editor.isEditable === false ? (
                        <IconLock size="1rem" />
                      ) : (
                        <IconLockOpen size="1rem" />
                      )}
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Get PDF" color='blue' withArrow position="bottom" openDelay={1000}>
                    <ActionIcon variant='default' onClick={() => generatePDF(editor.getHTML())} style={{ marginRight: '0.5rem' }} size={30}><IconPrinter size="1rem" /></ActionIcon>
                  </Tooltip>
                </div>
              </Group>
            </Box>

          </Navbar.Section>
          <Navbar.Section grow component={ScrollArea} mx="-xs" px="xs">
            <Box py="md">
              <Accordion variant="separated" radius="md" multiple={false} value={accValue} onChange={setAccValue}>
                <Accordion.Item value="ryms">
                  <Accordion.Control>
                    <Text>Rhymes</Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Grid>
                      <Grid.Col span={6}>
                        <Text fw={600} >Perfect</Text>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Text fw={600} >Similar</Text>
                      </Grid.Col>
                    </Grid>
                    {rhymes.perfectRhyme.map((word, index) => (
                      <Grid key={index}>
                        <Grid.Col span={6}>
                          {word === 'None Found' ? (
                            <Text >{word}</Text>
                          ) : (
                            <UnstyledButton
                              type="button"
                              onClick={() => DefineF(word)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                            >
                              {word}
                            </UnstyledButton>
                          )}
                        </Grid.Col>
                        <Grid.Col span={6}>
                          {rhymes.nearRhyme[index] === 'None Found' ? (
                            <Text >{rhymes.nearRhyme[index]}</Text>
                          ) : (
                            <UnstyledButton
                              type="button"
                              onClick={() => DefineF(rhymes.nearRhyme[index])}
                              style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                            >
                              {rhymes.nearRhyme[index]}
                            </UnstyledButton>
                          )}
                        </Grid.Col>
                      </Grid>
                    ))}
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item value="ml">
                  <Accordion.Control>
                    <Text>Word Finder</Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Grid gap={1}>
                      <Grid.Col span={12}>
                        <Textarea
                          aria-label="Word Finder Text Area"
                          placeholder="Describe the word you want to find"
                          value={searchWord}
                          onChange={(event) => setSearchWord(event.target.value)}
                          autosize
                          minRows={2}
                          maxRows={4}
                        />
                      </Grid.Col>
                      <Grid.Col span={12}>
                        <Button onClick={wordFind} disabled={!searchWord}>
                          Search
                        </Button>
                      </Grid.Col>
                    </Grid>
                    {meansLikeWords.length > 0 ? (
                      <ul style={{ paddingLeft: '1.5rem' }}>
                        {meansLikeWords.slice(0, numOfRhymes).map((word, index) => (
                          <li key={index} >
                            {word === 'None Found' ? (
                              <Text >{word}</Text>
                            ) : (
                              <UnstyledButton
                                type="button"
                                onClick={() => DefineF(word)}
                                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                              >
                                {word}
                              </UnstyledButton>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      meansLikeWords.length === 0 && isSearchButtonClicked && !isLoading && <Text >No words found</Text>
                    )}
                  </Accordion.Panel>
                </Accordion.Item>


                <Accordion.Item value="def">
                  <Accordion.Control>
                    <Text>Definitions</Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    {defList.length === 0 ? (
                      <Text >Select the word you want to define from the editor or click on a rhyme or word from the Tools section to see its definition</Text>
                    ) : (
                      <>
                        {defList[0] === 'None Found' ? (
                          <>
                            <Text fw={600} >{selectedWord.charAt(0).toUpperCase() + selectedWord.slice(1)}:</Text>
                            <ul style={{ paddingLeft: '1.5rem' }}>
                              <li >None Found</li>
                            </ul>
                          </>
                        ) : (
                          <>
                            <Text fw={600} >{selectedWord.charAt(0).toUpperCase() + selectedWord.slice(1)}:</Text>
                            <ul style={{ paddingLeft: '1.5rem', }}>
                              {defList.slice(0, Math.floor(numOfRhymes / 2)).map((definition, index) => (
                                <li key={index} ><Text >{definition.definition}</Text></li>
                              ))}
                            </ul>
                          </>
                        )}
                      </>
                    )}
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item value="syn">
                  <Accordion.Control>
                    <Text>Synonyms</Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    {synonyms.length > 0 ? (
                      <>
                        <Text fw={600} >{selectedWord.charAt(0).toUpperCase() + selectedWord.slice(1)}:</Text>
                        <ul style={{ paddingLeft: '1.5rem' }}>
                          {synonyms.slice(0, numOfRhymes).map((synonym, index) => (
                            <li key={index}>
                              {synonym === 'None Found' ? (
                                <Text >{synonym}</Text>
                              ) : (
                                <UnstyledButton
                                  type="button"
                                  onClick={() => DefineF(synonym)}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                                >
                                  {synonym}
                                </UnstyledButton>
                              )}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <Text >Select a word from the editor to search for synonyms</Text>
                    )}
                  </Accordion.Panel>
                </Accordion.Item>
                {advancedChecked ? (
                  <>
                    <Accordion.Item value="ant">
                      <Accordion.Control>
                        <Text>Antonyms</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        {antonyms.length > 0 ? (
                          <>
                            <Text fw={600} >{selectedWord.charAt(0).toUpperCase() + selectedWord.slice(1)}:</Text>
                            <ul style={{ paddingLeft: '1.5rem' }}>
                              {antonyms.slice(0, numOfRhymes).map((antonym, index) => (
                                <li key={index}>
                                  {antonym === 'None Found' ? (
                                    <Text >{antonym}</Text>
                                  ) : (
                                    <UnstyledButton
                                      type="button"
                                      onClick={() => DefineF(antonym)}
                                      style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                                    >
                                      {antonym}
                                    </UnstyledButton>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <Text >Select a word from the editor to search for antonyms</Text>
                        )}
                      </Accordion.Panel>
                    </Accordion.Item>
                    <Accordion.Item value="hom">
                      <Accordion.Control>
                        <Text>Homophones</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        {homophones.length > 0 ? (
                          <>
                            <Text fw={600} >{selectedWord.charAt(0).toUpperCase() + selectedWord.slice(1)}:</Text>
                            <ul style={{ paddingLeft: '1.5rem' }}>
                              {homophones.slice(0, numOfRhymes).map((homophone, index) => (
                                <li key={index}>
                                  {homophone === 'None Found' ? (
                                    <Text >{homophone}</Text>
                                  ) : (
                                    <UnstyledButton
                                      type="button"
                                      onClick={() => DefineF(homophone)}
                                      style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                                    >
                                      {homophone}
                                    </UnstyledButton>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <Text >Select a word from the editor to search for homophones</Text>
                        )}
                      </Accordion.Panel>
                    </Accordion.Item>
                  </>
                ) : (
                  <></>
                )}

              </Accordion>
            </Box>
          </Navbar.Section>
        </Navbar>
      }
      styles={(theme) => ({
        main: {
          backgroundColor:
            theme.colorScheme === 'dark' ? theme.colors.dark[8] : theme.colors.gray[0],
        },
      })}>
      <div className="App">
        <div className="container" heigh="100%">
          <RichTextEditor editor={editor} style={{ width: "100%" }} onKeyDown={getHotkeyHandler([
            ['mod+S', handleSave],
            ['mod+shift+J', handleCreate]
          ])}>
          <ScrollArea h="calc(95vh - var(--app-shell-header-height, 60px))" w="100%" type="none" style={{backgroundColor: dark ? "#1A1B1E" : 'white'}}>
            <Grid columns={48} gutter={{ base: 0, sm: 0, md: 0 }}>
              <Grid.Col span={4}>
                <Container w="20px" h="100%" bg={dark ? "#1A1B1E" : 'white'}></Container>
              </Grid.Col>
              <Grid.Col span={40}>
            {editor && (
              <>
                <BubbleMenu editor={editor} style={{ display: 'flex' }}>
                  <Button color="pink" variant="filled" compact onClick={() => rhymeF(window.getSelection().toString().trim().split(' ').pop(), 'select')} style={{ marginRight: '0.3rem' }}>
                    Rhymes
                  </Button>
                  <Button color="pink" variant="filled" compact onClick={() => thesaurusF(window.getSelection().toString().trim().split(' ').pop(), 'syn')} style={{ marginRight: '0.3rem' }}>
                    Synonims
                  </Button>
                  {advancedChecked ? (
                    <>
                      <Button color="pink" variant="filled" compact onClick={() => thesaurusF(window.getSelection().toString().trim().split(' ').pop(), 'ant')} style={{ marginRight: '0.3rem' }}>
                        Antonyms
                      </Button>
                      <Button color="pink" variant="filled" compact onClick={() => thesaurusF(window.getSelection().toString().trim().split(' ').pop(), 'hom')} style={{ marginRight: '0.3rem' }}>
                        Homophones
                      </Button>
                    </>
                  ) : (
                    <></>
                  )}
                  <Button color="pink" variant="filled" compact onClick={() => DefineF(window.getSelection().toString().trim().split(' ').pop())} style={{ marginRight: '0.3rem' }}>
                    Define
                  </Button>
                </BubbleMenu>
                <FloatingMenu editor={editor}>
                  {/* Possible Items for Floating Menu here */}
                </FloatingMenu>
              </>
            )}
            <RichTextEditor.Content value={text} />
            </Grid.Col> {/* This is for aligning the nums */}
            <Grid.Col span={4}>
              {editor.getText() !== '' ? // TODO: Make the button stay fixed in place
              <Menu withArrow width={240} shadow="md" position="left" trigger="hover" transitionProps={{ transition: scaleX, duration: 150 }} style={{position: 'sticky', top: '0'}}>
                <Menu.Target>
                <Center> 
                    <ActionIcon variant="default" size={30} style={{marginTop: '10px', marginRight: '3px'}}>
                      <IconBallpen size="1rem"/>
                    </ActionIcon>
                  </Center>
                </Menu.Target>
                <Menu.Dropdown>
                  <Center style={{marginTop: '-10px', marginLeft: '3px'}}>
                    <Grid justify="space-around" align="center" columns={15} gutter="xs">
                      <Grid.Col span={3}>
                        <ActionIcon variant="default" size="lg" style={{marginTop: '10px', marginRight: '3px'}} onClick={() => { editor?.commands.insertContent('<h3>verse</h3>'); editor?.commands.enter(); editor?.commands.focus(); }}>
                        <Text c="dimmed">V</Text>
                        </ActionIcon>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <ActionIcon variant="default" size="lg" style={{marginTop: '10px', marginRight: '3px'}} onClick={() => { editor?.commands.insertContent('<h3>pre chorus</h3>'); editor?.commands.enter(); editor?.commands.focus(); }}>
                          <Text c="dimmed">P</Text>
                        </ActionIcon>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <ActionIcon variant="default" size="lg" style={{marginTop: '10px', marginRight: '3px'}} onClick={() => { editor?.commands.insertContent('<h3>chorus</h3>'); editor?.commands.enter(); editor?.commands.focus(); }}>
                          <Text c="dimmed">C</Text>
                        </ActionIcon>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <ActionIcon variant="default" size="lg" style={{marginTop: '10px', marginRight: '3px'}} onClick={() => { editor?.commands.insertContent('<h3>bridge</h3>'); editor?.commands.enter(); editor?.commands.focus(); }}>
                          <Text c="dimmed">B</Text>
                        </ActionIcon>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <ActionIcon variant="default" size="lg" style={{marginTop: '10px', marginRight: '3px'}} onClick={() => { editor?.commands.insertContent('<h3>section</h3>'); editor?.commands.enter(); editor?.commands.focus(); }}>
                          <Text c="dimmed">O</Text>
                        </ActionIcon>
                      </Grid.Col>
                    </Grid>
                  </Center>
                </Menu.Dropdown>
              </Menu> 
              : <></>}
              <Container w="10px" h="100%" bg={dark ? "#1A1B1E" : 'white'}>
                {syllableList.length != 1 ? syllableList.map((number, index) => (
                  number == -1 ? 
                    <Text key={index} style={{ marginBottom: '0px', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none'}}>
                      {String.fromCharCode(160) /* Page Title */}
                    </Text>
                  : number == 0 ?
                    <Text key={index} style={{ marginBottom: '13px', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none'}}>
                      {String.fromCharCode(160) /* Section Header */}
                    </Text>
                  : number == -2 ?
                    <Text key={index} style={{ marginBottom: '8px', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none'}}>
                      {String.fromCharCode(160) /* Empty Line */}
                    </Text>
                  : <Text key={index} style={{ marginBottom: '8px', marginRight: '8px', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none'}} c="dimmed">
                      {number /* Line */}
                    </Text>
                )) : <></>}
              </Container>
            </Grid.Col>
            </Grid>
          </ScrollArea>
          </RichTextEditor>
        </div>
        <AuthenticationForm />
      </div>
    </AppShell>
  );
}