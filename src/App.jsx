import React, { useMemo } from 'react';
import { useState, useRef, useEffect, createContext, useContext } from 'react';
import { Center, ColorSchemeProvider, useMantineColorScheme, MantineProvider, rem, useMantineTheme, Skeleton } from '@mantine/core';
import { useLocalStorage, useHotkeys, useColorScheme } from '@mantine/hooks';
import { UserPanel } from './Components/_user.tsx';
//import { SearchSongInput } from './Components/_songSearch.tsx';
import { IconSettings, IconLockOpen, IconLock, IconFile, IconFileCheck, IconFilePencil, IconTrash, IconTrashOff, IconSun, IconMoonStars, IconPlus, IconAlertHexagon } from '@tabler/icons-react';
import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ModalsProvider, modals } from '@mantine/modals';
import { Notifications, notifications } from '@mantine/notifications';
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
  Input
} from '@mantine/core';
import { AuthenticationForm } from "./Components/auth.jsx"
import { auth, db } from './config/firebase'
import { onAuthStateChanged } from "firebase/auth";
import { getDocs, collection, setDoc, deleteDoc, doc, query, where, onSnapshot, QuerySnapshot } from 'firebase/firestore'
import { UnstyledButton } from '@mantine/core';
//import songs from `${process.env.PUBLIC_URL}/songs.json`;

import './App.css';
//import { isEditable } from '@testing-library/user-event/dist/utils/index.js';

//const mql = window.matchMedia(`(min-width: 800px)`);
//Context
export const isSavedCtx = createContext({});
//export const songListCtx = createContext({});

//const API_KEY = '/1gJtFMabYLBlll1mYo+Og==m9WXbzQarLTMvbLI';
let numOfRhymes = 8;

export default function App() {
  const [colorScheme, setColorScheme] = useLocalStorage('mantine-color-scheme', 'dark');

  const toggleColorScheme = (value) =>
    setColorScheme(value || (colorScheme === 'dark' ? 'light' : 'dark'));

  useHotkeys([['mod+J', () => toggleColorScheme()]]);
  return (
    <>
      <ColorSchemeProvider colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
        <MantineProvider theme={{ colorScheme }} withGlobalStyles withNormalizeCSS>
          <Notifications limit={2} />
          <ModalsProvider>
            <MainApp />
          </ModalsProvider>
        </MantineProvider>
      </ColorSchemeProvider>
    </>
  );
}
function MainApp() {
  //App Theme
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  //const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [opened, setOpened] = useState(false);
  //For the Rhyming Functionality
  const [words, setWords] = useState([]);
  const [text, setText] = useState('');
  const timerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rhymes, setRhymes] = useState({ perfectRhyme: [], nearRhyme: [] });

  //Accordion Control
  const [accValue, setAccValue] = useState("");

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

  //Synonims Functionality
  const [synonyms, setSynonyms] = useState([])
  async function SynF(word) {
    setIsLoading(true);
    setSelectedWord(word.trim().split(" ").pop().replace(/[.,!?]+$/, ''));
    try {
      const synonymUrl = `https://api.datamuse.com/words?rel_syn=${word.replace(/[.,!?]+$/, '')}`;

      const response = await fetch(synonymUrl);

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const responseJson = await response.json();

      const synonyms = responseJson.length > 0
        ? responseJson.map(({ word }) => word)
        : ['None Found'];

      setSynonyms(synonyms);
    } catch (error) {
      console.error('Error:', error);
      setSynonyms(['None found']);
    } finally {
      setIsLoading(false);
      setAccValue('syns');
    }
  }

  //Dictionary Function
  const [defList, setDefState] = useState([])
  const [selectedWord, setSelectedWord] = useState('');
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
          _songs.push(doc.data());
        });
        setSongList(_songs);
      });
      if (!isSigned) {
        unsubscribe();
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
  const handleSave = async () => {
    let text = await editor?.getHTML()?.replaceAll('</p><p>', '\n')?.replace('<p>', '')?.replace('</p>', '')?.replaceAll('<h2>', '')?.replaceAll('</h2>', '\n') ?? '';
    const lines = text.split('\n');
    const key = lines[0]?.trim();
    const value = lines?.slice(1).join('\n').trim();
    const id = uid + "-" + key
    if (key !== '') {
      try {
        await setDoc(doc(db, "Lyrics", id), {
          title: key,
          lyrics: value,
          _uid: uid,
          _sid: id,
        });
        console.log("read")
        setIsSaved(true);
        //handleOpen(uid, key, value);
        /*getSongList();*/
        notifications.show({
          title: '"' + key + '" was succesfully saved!',
          message: 'Well done with this one!',
          styles: (theme) => ({
            root: {
              backgroundColor: theme.colors.white,
              borderColor: theme.colors.red,

              '&::before': { backgroundColor: theme.colors.teal[6] },
            },
          }),
        })
      } catch (err) {
        //This doesn't work quite the way it should
        setIsSaved(false)
        console.log("There was an Error when saving: " + err.code)
        modals.openContextModal({
          modal: 'errorSaving',
          title: 'There was an Error while saving the song',
          innerProps: {
            modalBody:
              'Error: ' + err.code,
          },
        })
      }
    }
  };

  //OpenFile
  const handleOpen = (uid, title, lyrics) => {
    if (editor.isEditable === true) {
      editor.commands.setContent('<h2>' + title + '</h2>');
      editor.commands.enter();
      let lys = '<p>' + lyrics.replaceAll("\\n", '</p><p>') + '</p>';
      editor.commands.insertContent(lys);
      setIsSaved(true)
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
      /*getSongList();*/
    } else {
      notifications.show({
        title: 'Editor is Locked',
        message: 'Unlock the editor to open "' + title + '"',
      })
    }
  }
  //Create File
  const handleCreate = () => {
    editor?.commands.clearContent();
    editor?.commands.insertContent(`<h2>Untitled ${Math.trunc(Math.random() * 100000)}</h2>`);
    editor?.commands.enter();
    editor?.commands.focus();
    notifications.show({
      title: 'New song created!',
      message: 'Good Luck!',
      styles: (theme) => ({
        root: {
          '&::before': { backgroundColor: theme.colors.teal[6] },
        },
      }),
    });
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
    })
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

  //Clear something idk, this function was made by ChatGPT and it works so i leave it
  /*const handleClear = () => {
    setText('');
    setWords([]);
    setRhymes({ currentLine: [], previousLine: [] });
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }*/
  //For the accordion
  //const [value, setValue] = useState <Mant string | null > (null);
  const [editable, setEditable] = useState(true);
  const editor = useEditor({
    editable,
    extensions: [StarterKit],
    content: '',
    onSave: (editorContent) => {
      setText(editorContent);
    },
    onUpdate: ({ editor }) => {
      setIsSaved(false);
      let html = editor.getHTML()
      let apiText = html.replaceAll('</p><p>', '\n').replace('<p>', '').replace('</p>', '')
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

  return (
    <AppShell
      padding="md"
      fixed={false}
      navbarOffsetBreakpoint="sm"
      header={
        <Header height={60}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Title order={1} ta="center">Lyricend</Title>
          </div>
        </Header>
      }
      navbar={
        <Navbar p="xs" hiddenBreakpoint="sm" hidden={!opened} width={{ sm: 250, lg: 400 }}>
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
                <Title order={3}>Projects</Title>
                <div style={{ display: 'flex', alignItems: 'center' }}>
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
                  {editor.getText() !== '' ? (<Tooltip label="Save" color='blue' withArrow position="bottom" openDelay={1000}>
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
                <UnstyledButton key={song._sid}
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
                      handleOpen(song._uid, song.title, song.lyrics)
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
                          handleOpen(song._uid, song.title, song.lyrics)
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
                          await handleOpen(song._uid, song.title, song.lyrics);
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
                      <Text size="sm">{song.title}</Text>
                    </Group>
                    <ActionIcon
                      variant="subtle"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (editor.isEditable) {
                          openDeleteModal(song._sid, song.title)
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
            />
            <isSavedCtx.Provider value={{ isSaved, setIsSaved, editor }}>
              <UserPanel />
            </isSavedCtx.Provider>
          </Navbar.Section>
        </Navbar>
      }
      aside={
        <Navbar p="xs" hiddenBreakpoint="sm" hidden={!opened} width={{ sm: 250, lg: 400 }}>
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
                <Title order={3} >Tools {isLoading && <Loader color="pink" variant="dots" size="sm" />}{' '}</Title>
                <div style={{ display: 'flex', alignItems: 'center' }}>
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
                  <Tooltip label={dark ? 'Light Mode' : 'Dark Mode'} color="blue" withArrow position="bottom" openDelay={1000}>
                    <ActionIcon
                      variant="default"
                      color={dark ? 'yellow' : 'blue'}
                      onClick={() => toggleColorScheme()}
                      title="Toggle color scheme"
                    >
                      {dark ? <IconSun size="1.1rem" /> : <IconMoonStars size="1.1rem" />}
                    </ActionIcon>
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

                <Accordion.Item value="syns">
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
        <div className="container">
          <RichTextEditor editor={editor} style={{ width: "100%" }}>
            {editor && (
              <>
                <BubbleMenu editor={editor} style={{ display: 'flex' }}>
                  <Button color="pink" variant="light" compact onClick={() => rhymeF(window.getSelection().toString().trim().split(' ').pop(), 'select')} style={{ marginRight: '0.3rem' }}>
                    Rhymes
                  </Button>
                  <Button color="pink" variant="light" compact onClick={() => SynF(window.getSelection().toString().trim().split(' ').pop())} style={{ marginRight: '0.3rem' }}>
                    Synonims
                  </Button>
                  <Button color="pink" variant="light" compact onClick={() => DefineF(window.getSelection().toString().trim().split(' ').pop())} style={{ marginRight: '0.3rem' }}>
                    Define
                  </Button>
                </BubbleMenu>
                <FloatingMenu editor={editor}>
                  <RichTextEditor.ControlsGroup>
                    <RichTextEditor.Control
                      onClick={() => { editor?.commands.insertContent('<h3>verse</h3>'); editor?.commands.enter(); editor?.commands.focus(); }}
                      title="Intro"
                    >
                      <Text size="0.6rem">verse</Text>
                    </RichTextEditor.Control>
                    <RichTextEditor.Control
                      onClick={() => { editor?.commands.insertContent('<h3>pre chorus</h3>'); editor?.commands.enter(); editor?.commands.focus(); }}
                      title="Pre-chorus"
                    >
                      <Text size="0.6rem"> pre </Text>
                    </RichTextEditor.Control>
                    <RichTextEditor.Control
                      onClick={() => { editor?.commands.insertContent('<h3>chorus</h3>'); editor?.commands.enter(); editor?.commands.focus(); }}
                      title="Chorus"
                    >
                      <Text size="0.6rem">chorus</Text>
                    </RichTextEditor.Control>
                    <RichTextEditor.Control
                      onClick={() => { editor?.commands.insertContent('<h3>bridge</h3>'); editor?.commands.enter(); editor?.commands.focus(); }}
                      title="Bridge"
                    >
                      <Text size="0.6rem">bridge</Text>
                    </RichTextEditor.Control>
                  </RichTextEditor.ControlsGroup>
                </FloatingMenu>
              </>
            )}
            <RichTextEditor.Content value={text} />
          </RichTextEditor>
        </div>
        <AuthenticationForm />
      </div>
    </AppShell>
  );
}