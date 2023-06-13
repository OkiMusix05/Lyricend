// @ts-nocheck
import { useState, useRef, useContext, useEffect } from 'react';
import { Autocomplete, Loader, ActionIcon } from '@mantine/core';
import { songListCtx } from '../App';
import { IconArrowRight, IconSearch } from '@tabler/icons-react';
import { auth } from '../config/firebase'

export function SearchSongInput() {
    const timeoutRef = useRef<number>(-1);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<string[]>([]);
    const { songList, setSongList, /*getSongList,*/ searchSongFilter, setSearchSongFilter } = useContext(songListCtx);
    const [element, setElement] = useState(undefined);
    const ref = useRef<HTMLInputElement>(null);

    const handleChange = (val: string) => {
        window.clearTimeout(timeoutRef.current);
        setSearchSongFilter(val);
        setData([]);

        if (val.trim().length === 0 || val.includes('@')) {
            setLoading(false);
        } else {
            setLoading(true);
            timeoutRef.current = window.setTimeout(() => {
                setLoading(false);
                //setData(['gmail.com', 'outlook.com', 'yahoo.com'].map((provider) => `${val}@${provider}`));
                setData(songList.map((song) => `${song.title}`));
            }, 400);
        }
    };
    useEffect(() => {
        if (searchSongFilter !== '') {
            const foundElement = songList.find((song) => song.title === searchSongFilter && song._uid === auth.currentUser.uid);
            setElement(foundElement);
        } else if (searchSongFilter === '') {
            //getSongList();
        }
    }, [songList, searchSongFilter]);
    const handleSongSelect = () => {
        console.log(element)
        if (element) {
            setSongList([element]);
        }
    };

    return (
        <Autocomplete
            value={searchSongFilter}
            data={data}
            onChange={handleChange}
            rightSection={loading ? <Loader size="1rem" /> : null}
            placeholder="Search in your songs..."
            dropdownPosition="top"
            rightSection={
                <ActionIcon size={24} radius="xl" color='blue' variant="filled" onClick={handleSongSelect} disabled={searchSongFilter === '' ? true : false}>
                    <IconSearch size="0.8rem" stroke={1.5} />
                </ActionIcon>
            }
        />
    );
}