use std::sync::Mutex;

#[derive(Default)]
pub struct PendingFiles(pub Mutex<Vec<String>>);

#[derive(Default)]
pub struct OpenFile(pub Mutex<Option<String>>);
