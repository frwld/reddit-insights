import React from 'react';

import {Typography, Avatar, Grid} from '@mui/material';

import InterestsOutlinedIcon from '@mui/icons-material/InterestsOutlined';

export const DysisPopupInterests = (): JSX.Element => {

  return (
    <Grid container item
      spacing={0}
      direction={"column"}
      alignItems={"center"}>
      <Avatar>
        <InterestsOutlinedIcon/>
      </Avatar>
      <Typography 
        variant="h5" 
        gutterBottom
        component="h5">
        Interests
      </Typography>
      <Grid item xs={12} marginBottom={1}>
        <span
          style={{
            borderRadius: '8px 8px 8px 8px',
            margin: '5px',
            padding: '2px 4px',
          }}>
          <span
            style={{
              borderRadius: '8px 0px 0px 8px',
              padding: '2px 4px',
              color: 'black',
              backgroundColor: 'lightblue'
            }}>
            subreddit (interest)
          </span>
          <span
            style={{
              borderRadius: '0px 8px 8px 0px',
              padding: '2px 4px',
              color: 'white',
              backgroundColor: 'darkblue'
            }}>
            no. of posts
          </span>
        </span>
      </Grid>
      <Typography 
        variant="body1" 
        gutterBottom
        component="p"
        align="center">
        Up to 100 posts from a user are analyzed to display which topics a user is interested in.
      </Typography>    
    </Grid>
  )
}